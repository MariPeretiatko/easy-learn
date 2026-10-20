import { useState, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Layers,
  Star,
  Copy,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { perform, useUI } from "../store/useUI";
import {
  Confirm,
  Empty,
  Loading,
  Meter,
  Modal,
  PageHeading,
  SearchInput,
} from "../components/UI";
import { DeckRepository, remember } from "../services/repositories";
import { DeckEditor } from "../features/decks/DeckEditor";
import { shortDate, statusNames } from "../utils/format";
import type { Deck } from "../types";
import { download, vocabularyCSV } from "../services/csv";
export function DecksPage() {
  const data = useData();
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<Deck | undefined>();
  const [remove, setRemove] = useState<Deck | null>(null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const language = useSettings((s) => s.settings.learningLanguage);
  if (!data) return <Loading />;
  const decks = data.decks.filter(
    (d) =>
      d.language === language &&
      (!favorites || d.favorite) &&
      `${d.title} ${d.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="СЛОВА СО СМЫСЛОМ"
        title="Мои колоды"
        description="Собирайте слова по темам, историям и интересам."
        actions={
          <button className="button" onClick={() => setParams({ add: "1" })}>
            <Plus size={17} />
            Создать колоду
          </button>
        }
      />
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Найти колоду или тему"
        />
        <button
          className={`button ${favorites ? "" : "secondary"}`}
          onClick={() => setFavorites(!favorites)}
        >
          <Star size={15} />
          Избранное
        </button>
      </div>
      {decks.length ? (
        <div className="card-grid">
          {decks.map((d) => {
            const words = data.words.filter((w) => d.wordIds.includes(w.id));
            const mastered = words.filter(
              (w) => w.status === "mastered",
            ).length;
            const due = words.filter(
              (w) => w.status !== "ignored" && w.nextReviewAt <= Date.now(),
            ).length;
            return (
              <article className="library-card" key={d.id}>
                <div className="card-top">
                  <span className="card-symbol">
                    <Layers size={23} />
                  </span>
                  <button
                    className={`icon-button ${d.favorite ? "active" : ""}`}
                    aria-label="Избранная колода"
                    onClick={() =>
                      void perform(() =>
                        DeckRepository.save({ ...d, favorite: !d.favorite }),
                      )
                    }
                  >
                    <Star
                      size={16}
                      fill={d.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <Link to={`/decks/${d.id}`}>
                  <h3>{d.title}</h3>
                </Link>
                <p>{d.description || "Ваша коллекция новых открытий."}</p>
                <div className="tag-list">
                  {d.tags.filter(Boolean).map((t) => (
                    <span className="tag" key={t}>
                      #{t}
                    </span>
                  ))}
                </div>
                <div className="card-meta">
                  <span>{words.length} слов</span>
                  <span>
                    {words.length
                      ? Math.round((mastered / words.length) * 100)
                      : 0}
                    % изучено
                  </span>
                </div>
                <Meter value={mastered} total={words.length} />
                <div className="card-meta">
                  <span>{due} к повторению</span>
                  <span>
                    {d.lastStudiedAt
                      ? shortDate(d.lastStudiedAt)
                      : "Ещё не изучали"}
                  </span>
                </div>
                <div className="card-footer">
                  <Link to={`/decks/${d.id}`}>
                    Открыть <ArrowRight size={14} />
                  </Link>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label="Редактировать колоду"
                      onClick={() => setEdit(d)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Копировать колоду"
                      onClick={() =>
                        void perform(
                          () => DeckRepository.duplicate(d),
                          "Копия колоды создана",
                        )
                      }
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Удалить колоду"
                      onClick={() => setRemove(d)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Место для ваших интересов"
          description="Создайте колоду для путешествия, книги или повседневного общения."
          action={
            <button className="button" onClick={() => setParams({ add: "1" })}>
              Создать первую колоду
            </button>
          }
        />
      )}
      {(params.has("add") || edit) && (
        <DeckEditor
          deck={edit}
          onClose={() => {
            setEdit(undefined);
            setParams({});
          }}
        />
      )}
      {remove && (
        <Confirm
          title={`Удалить «${remove.title}»?`}
          description="Колода будет удалена. Слова останутся в вашем словаре."
          onClose={() => setRemove(null)}
          onConfirm={() =>
            void perform(async () => {
              await DeckRepository.delete(remove.id);
              setRemove(null);
            }, "Колода удалена")
          }
        />
      )}
    </>
  );
}
export function DeckPage() {
  const { id } = useParams();
  const data = useData();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const deck = data?.decks.find((d) => d.id === id);
  useEffect(() => {
    if (deck) void perform(() => remember("decks", deck.id, deck.title));
  }, [deck?.id, deck?.title]);
  if (!data) return <Loading />;
  if (!deck)
    return (
      <Empty
        title="Колода не найдена"
        description="Возможно, она была удалена."
        action={
          <Link to="/decks" className="button">
            Все колоды
          </Link>
        }
      />
    );
  const words = data.words.filter((w) => deck.wordIds.includes(w.id));
  const mastered = words.filter((w) => w.status === "mastered").length;
  return (
    <>
      <Link className="back-link" to="/decks">
        <ArrowLeft size={15} />
        Мои колоды
      </Link>
      <PageHeading
        eyebrow={`${words.length} СЛОВ · ${Math.round((mastered / Math.max(words.length, 1)) * 100)}% ИЗУЧЕНО`}
        title={deck.title}
        description={deck.description}
        actions={
          <button className="button" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Добавить слова
          </button>
        }
      />
      <div className="toolbar">
        <button
          className="button secondary"
          onClick={() =>
            download(
              `${deck.title}.csv`,
              vocabularyCSV(words),
              "text/csv;charset=utf-8",
            )
          }
        >
          Экспорт CSV
        </button>
        {[
          ["flashcards", "Карточки"],
          ["learn", "Учить"],
          ["test", "Тест"],
          ["match", "Подбор пар"],
          ["review", "Повторить"],
        ].map(([mode, title]) => (
          <Link
            className={`button ${mode === "flashcards" ? "" : "secondary"}`}
            key={mode}
            to={`/learn?deck=${deck.id}&mode=${mode}`}
          >
            {title}
          </Link>
        ))}
      </div>
      {words.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>СЛОВО</th>
                <th>ПЕРЕВОД</th>
                <th>СТАТУС</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link className="row-link" to={`/vocabulary?word=${w.id}`}>
                      {w.term}
                    </Link>
                  </td>
                  <td>{w.translation}</td>
                  <td>
                    <span className={`badge ${w.status}`}>
                      {statusNames[w.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label="Убрать из колоды"
                      onClick={() =>
                        void perform(() =>
                          DeckRepository.save({
                            ...deck,
                            wordIds: deck.wordIds.filter((i) => i !== w.id),
                            updatedAt: Date.now(),
                          }),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Добавьте немного вдохновения"
          description="Выберите слова из словаря или создайте новые."
          action={
            <button className="button" onClick={() => setAdding(true)}>
              Добавить слова
            </button>
          }
        />
      )}
      {adding && (
        <Modal title="Слова для колоды" onClose={() => setAdding(false)}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Найти слово"
          />
          <div style={{ maxHeight: 350, overflow: "auto", marginTop: 20 }}>
            {data.words
              .filter(
                (w) =>
                  w.language === deck.language &&
                  w.term.toLowerCase().includes(query.toLowerCase()),
              )
              .map((w) => (
                <label className="check-label" key={w.id}>
                  <input
                    type="checkbox"
                    checked={deck.wordIds.includes(w.id)}
                    onChange={(e) =>
                      void perform(() =>
                        DeckRepository.save({
                          ...deck,
                          wordIds: e.target.checked
                            ? [...deck.wordIds, w.id]
                            : deck.wordIds.filter((i) => i !== w.id),
                          updatedAt: Date.now(),
                        }),
                      )
                    }
                  />
                  {w.term} — {w.translation}
                </label>
              ))}
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => {
                setAdding(false);
                useUI.getState().openWord({ language: deck.language });
              }}
            >
              Создать новое слово
            </button>
            <button className="button" onClick={() => setAdding(false)}>
              Готово
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
