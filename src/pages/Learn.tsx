import { Link, useSearchParams } from "react-router-dom";
import { Layers, Brain, ClipboardCheck, Puzzle, RotateCcw } from "lucide-react";
import { Loading, PageHeading } from "../components/UI";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { PracticeSession } from "../features/learning/PracticeSession";
import { StudyModeCards } from "../components/StudyModeCards";
const modes = [
  ["flashcards", "Карточки", "Знакомьтесь со словами в своём ритме.", Layers],
  ["review", "Повторение", "Встречайтесь со словами вовремя.", RotateCcw],
  ["learn", "Учить", "Разные задания, одна цель — запомнить.", Brain],
  ["test", "Проверить себя", "Посмотрите, что уже получается.", ClipboardCheck],
  ["match", "Подбор пар", "Найдите пары слов и переводов.", Puzzle],
] as const;
export function LearnPage() {
  const data = useData();
  const [params] = useSearchParams();
  const language = useSettings((s) => s.settings.learningLanguage);
  const mode = params.get("mode");
  const deckId = params.get("deck") ?? undefined;
  if (!data) return <Loading />;
  const deck = data.decks.find((d) => d.id === deckId);
  const words = data.words.filter(
    (w) =>
      w.language === language &&
      w.status !== "ignored" &&
      (!deckId || deck?.wordIds.includes(w.id)),
  );
  const queue =
    mode === "review"
      ? words.filter((w) => w.nextReviewAt <= Date.now())
      : words;
  return (
    <>
      <PageHeading
        eyebrow="ВРЕМЯ ДЛЯ ПРАКТИКИ"
        title={
          mode
            ? (modes.find((m) => m[0] === mode)?.[1] ?? "Практика")
            : "Как вы хотите заниматься?"
        }
        description={
          deck?.title ?? "Учитесь на словах из собственного словаря."
        }
        actions={
          mode ? (
            <Link className="button secondary" to="/learn">
              Все режимы
            </Link>
          ) : undefined
        }
      />
      {!mode ? (
        <>
          <StudyModeCards deckId={deckId} />
          <section className="panel review-callout">
            <div>
              <h2>Время повторить знакомое</h2>
              <p className="muted">
                Слов к повторению:{" "}
                {words.filter((w) => w.nextReviewAt <= Date.now()).length}.
                Небольшая практика поможет закрепить знания.
              </p>
            </div>
            <Link
              className="button"
              to={"/learn?mode=review" + (deckId ? "&deck=" + deckId : "")}
            >
              Начать повторение
            </Link>
          </section>
        </>
      ) : (
        <PracticeSession
          key={`${language}-${mode}-${deckId ?? "all"}`}
          words={queue}
          mode={mode}
          deckId={deckId}
        />
      )}
    </>
  );
}
