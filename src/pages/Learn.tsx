import { collectionsForLanguage } from "../services/libraryScope";
import { useSubjectNames } from "../hooks/useSubjectNames";
import { Link, useSearchParams } from "react-router-dom";
import { Layers, Brain, ClipboardCheck, Puzzle, RotateCcw } from "lucide-react";
import { Empty, Loading, PageHeading } from "../components/UI";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { PracticeSession } from "../features/learning/PracticeSession";
import { StudySelection } from "../components/StudySelection";
import { collectionDeckIds } from "../services/collections";

const modes = [
  ["flashcards", "Карточки", "Знакомьтесь со словами в своём ритме.", Layers],
  ["review", "Повторение", "Встречайтесь со словами вовремя.", RotateCcw],
  ["learn", "Учить", "Разные задания, одна цель — запомнить.", Brain],
  ["test", "Тест", "Посмотрите, что уже получается.", ClipboardCheck],
  ["blast", "Blast", "Отвечайте быстро и набирайте очки.", Puzzle],
  ["match", "Подбор пар", "Найдите пары слов и переводов.", Puzzle],
] as const;
export function LearnPage() {
  const languages = useSubjectNames();
  const data = useData(["words", "decks", "collections"]);
  const [params] = useSearchParams();
  const language = useSettings((s) => s.settings.learningLanguage);
  const requestedMode = params.get("mode") ?? "review";
  const mode = requestedMode === "blocks" ? "match" : requestedMode;
  const deckIds = params.getAll("deck").filter(Boolean);
  const deckId = deckIds.length === 1 ? deckIds[0] : undefined;
  const collectionIds = [
    ...new Set(params.getAll("collection").filter(Boolean)),
  ];
  if (!data) return <Loading />;
  if (!deckIds.length && !collectionIds.length)
    return (
      <StudySelection
        mode={mode}
        language={language}
        decks={data.decks}
        collections={data.collections}
        words={data.words}
      />
    );
  const selectedDecks = data.decks.filter(
    (deck) => deck.language === language && deckIds.includes(deck.id),
  );
  const collections = collectionsForLanguage(
    data.collections,
    data.decks,
    language,
  );
  const deck = selectedDecks.length === 1 ? selectedDecks[0] : undefined;
  const selectedCollections = collections.filter((collection) =>
    collectionIds.includes(collection.id),
  );
  const collection =
    selectedCollections.length === 1 ? selectedCollections[0] : undefined;
  if (
    selectedCollections.length !== collectionIds.length ||
    selectedDecks.length !== deckIds.length
  )
    return (
      <Empty
        title="Материалы не найдены"
        description="Возможно, структура библиотеки изменилась. Выберите модуль или колоды заново."
        action={
          <Link className="button" to={`/learn?mode=${mode}`}>
            Выбрать материалы
          </Link>
        }
      />
    );
  const scopeDeckIds = new Set([
    ...selectedDecks.map((deck) => deck.id),
    ...selectedCollections.flatMap((collection) =>
      collectionDeckIds(collection, collections),
    ),
  ]);
  const scopedDecks = data.decks.filter(
    (deck) => deck.language === language && scopeDeckIds.has(deck.id),
  );
  const practiceLanguage = scopedDecks[0]?.language ?? language;
  const selectedWords = new Set(scopedDecks.flatMap((deck) => deck.wordIds));
  const sourceTitle =
    deck?.title ??
    collection?.title ??
    (selectedCollections.length
      ? `${selectedCollections.length} выбранных модулей`
      : `${selectedDecks.length} выбранных колод`);
  const words = data.words.filter(
    (word) =>
      word.language === practiceLanguage &&
      word.status !== "ignored" &&
      (!params.get("starred") || word.favorite) &&
      selectedWords.has(word.id),
  );
  const queue =
    mode === "review"
      ? words.filter((w) => w.nextReviewAt <= Date.now())
      : words;
  const actions = (
    <>
      <Link className="button secondary" to={`/learn?mode=${mode}`}>
        Изменить выбор
      </Link>
      <Link
        className="button secondary"
        to={
          deck
            ? `/sets/${deck.id}`
            : collection
              ? `/${collection.kind === "course" ? "modules" : "folders"}/${collection.id}`
              : "/library"
        }
      >
        {deck ? "К колоде" : collection ? "К модулю" : "В библиотеку"}
      </Link>
    </>
  );
  return (
    <>
      {mode === "test" ? (
        <nav className="quiz-context-actions" aria-label="Материалы теста">
          {actions}
        </nav>
      ) : (
        <PageHeading
          eyebrow="ВРЕМЯ ДЛЯ ПРАКТИКИ"
          title={modes.find((item) => item[0] === mode)?.[1] ?? "Практика"}
          description={`${languages[practiceLanguage]} · ${sourceTitle}`}
          actions={actions}
        />
      )}

      <PracticeSession
        key={`${practiceLanguage}-${mode}-${[...deckIds, ...collectionIds].join(",")}-${params.get("starred") ?? ""}`}
        title={sourceTitle}
        words={queue}
        mode={mode}
        deckId={deckId}
      />
    </>
  );
}
