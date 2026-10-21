import { VocabularyTable } from "../features/vocabulary/VocabularyTable";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { perform, useUI } from "../store/useUI";
import {
  Confirm,
  Empty,
  Loading,
  PageHeading,
  SearchInput,
} from "../components/UI";
import { WordRepository } from "../services/repositories";
import { statusNames } from "../utils/format";
import { WordDetails } from "../features/vocabulary/WordDetails";
import { ImportCSV } from "../features/vocabulary/ImportCSV";
import { download, vocabularyCSV } from "../services/csv";
export function VocabularyPage() {
  const data = useData(["words", "decks"]);
  const [importing, setImporting] = useState(false);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [deck, setDeck] = useState("");
  const [tag, setTag] = useState("");
  const [pos, setPos] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [deletion, setDeletion] = useState<string[] | null>(null);
  const [move, setMove] = useState("");
  const [page, setPage] = useState(0);
  const { settings } = useSettings();
  const openWord = useUI((s) => s.openWord);
  useEffect(() => {
    setSelected([]);
    setDeck("");
    setTag("");
    setPos("");
    setMove("");
    setPage(0);
  }, [settings.learningLanguage]);
  if (!data) return <Loading />;
  const current = data.words.filter(
    (w) => w.language === settings.learningLanguage,
  );
  const deckData = data.decks.find((d) => d.id === deck);
  const words = current
    .filter(
      (w) =>
        (!query ||
          `${w.term} ${w.translation} ${w.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (filter === "all" ||
          (filter === "favorites"
            ? w.favorite
            : filter === "difficult"
              ? w.difficulty >= 4
              : w.status === filter)) &&
        (!deck || deckData?.wordIds.includes(w.id)) &&
        (!tag || w.tags.includes(tag)) &&
        (!pos || w.partOfSpeech === pos) &&
        (!date || w.createdAt >= new Date(date).getTime()),
    )
    .sort((a, b) =>
      sort === "term"
        ? a.term.localeCompare(b.term)
        : sort === "due"
          ? a.nextReviewAt - b.nextReviewAt
          : b.createdAt - a.createdAt,
    );
  const pages = Math.max(1, Math.ceil(words.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const visible = words.slice(currentPage * 20, currentPage * 20 + 20);
  const detail = data.words.find((w) => w.id === params.get("word"));
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  return (
    <>
      <PageHeading
        eyebrow="ВАША КОЛЛЕКЦИЯ"
        title="Словарь"
        description={`${current.length} слов и выражений. Каждое — шаг вперёд.`}
        actions={
          <button className="button" onClick={() => openWord()}>
            <Plus size={17} />
            Добавить слово
          </button>
        }
      />
      <div className="toolbar">
        <button className="button secondary" onClick={() => setImporting(true)}>
          Импорт CSV
        </button>
        <button
          className="button secondary"
          onClick={() =>
            download(
              "vocabulary.csv",
              vocabularyCSV(words),
              "text/csv;charset=utf-8",
            )
          }
        >
          Экспорт CSV
        </button>
      </div>
      {importing && <ImportCSV onClose={() => setImporting(false)} />}
      <div className="tabs">
        {Object.entries({
          all: "Все слова",
          ...statusNames,
          difficult: "Сложные",
          favorites: "Избранное",
        }).map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => reset(() => setFilter(value))}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={(v) => reset(() => setQuery(v))}
          placeholder="Найти слово или перевод"
        />
        <select
          aria-label="Фильтр по колоде"
          value={deck}
          onChange={(e) => reset(() => setDeck(e.target.value))}
        >
          <option value="">Все колоды</option>
          {data.decks
            .filter((d) => d.language === settings.learningLanguage)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
        </select>
        <select
          aria-label="Тег"
          value={tag}
          onChange={(e) => reset(() => setTag(e.target.value))}
        >
          <option value="">Все теги / темы</option>
          {[...new Set(current.flatMap((w) => w.tags))]
            .filter(Boolean)
            .map((t) => (
              <option key={t}>{t}</option>
            ))}
        </select>
        <select
          aria-label="Часть речи"
          value={pos}
          onChange={(e) => reset(() => setPos(e.target.value))}
        >
          <option value="">Все части речи</option>
          {[...new Set(current.map((w) => w.partOfSpeech))]
            .filter(Boolean)
            .map((t) => (
              <option key={t}>{t}</option>
            ))}
        </select>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Сначала новые</option>
          <option value="term">По алфавиту</option>
          <option value="due">По дате повторения</option>
        </select>
        <input
          style={{ width: 155 }}
          aria-label="Добавлено после даты"
          type="date"
          value={date}
          onChange={(e) => reset(() => setDate(e.target.value))}
        />
      </div>
      {selected.length > 0 && (
        <div className="toolbar notice">
          <strong>Выбрано: {selected.length}</strong>
          <button
            className="button secondary"
            onClick={() => setDeletion(selected)}
          >
            Удалить выбранные
          </button>
          <select
            aria-label="Добавить выбранные в колоду"
            value={move}
            onChange={(e) => setMove(e.target.value)}
          >
            <option value="">В какую колоду?</option>
            {data.decks
              .filter((d) => d.language === settings.learningLanguage)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
          </select>
          <button
            className="button"
            disabled={!move}
            onClick={() =>
              void perform(async () => {
                await WordRepository.move(selected, move);
                setSelected([]);
              }, "Слова добавлены в колоду")
            }
          >
            Добавить в колоду
          </button>
          <button className="button ghost" onClick={() => setSelected([])}>
            Снять выбор
          </button>
        </div>
      )}
      {words.length ? (
        <>
          <VocabularyTable
            visible={visible}
            decks={data.decks}
            selected={selected}
            setSelected={setSelected}
            onDetails={(id) => setParams({ word: id })}
            onDelete={setDeletion}
          />
          <div className="pagination">
            <span>
              {words.length} слов · Страница {currentPage + 1} из {pages}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Предыдущая страница"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Следующая страница"
                disabled={currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          title={
            current.length
              ? "Ничего не найдено"
              : "Ваш словарь начинается здесь"
          }
          description={
            current.length
              ? "Попробуйте другой запрос или измените фильтры."
              : "Добавьте первое слово. Сохраняйте не только перевод, но и контекст."
          }
          action={
            <button className="button" onClick={() => openWord()}>
              Добавить слово
            </button>
          }
        />
      )}
      {detail && <WordDetails word={detail} onClose={() => setParams({})} />}
      {deletion && (
        <Confirm
          title="Удалить слова?"
          description={`Будет удалено слов: ${deletion.length}. Они также исчезнут из колод. Отменить это действие нельзя.`}
          onClose={() => setDeletion(null)}
          onConfirm={() =>
            void perform(async () => {
              await WordRepository.delete(deletion);
              setSelected([]);
              setDeletion(null);
            }, "Слова удалены")
          }
        />
      )}
    </>
  );
}
