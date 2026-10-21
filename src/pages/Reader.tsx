import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  BookOpen,
  Star,
  Pencil,
  Trash2,
  Moon,
  Check,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { perform } from "../store/useUI";
import {
  Confirm,
  Empty,
  Loading,
  Meter,
  PageHeading,
  SearchInput,
} from "../components/UI";
import { TextRepository, remember } from "../services/repositories";
import { TextEditor } from "../features/reader/TextEditor";
import { InteractiveText, tokenize } from "../features/reader/InteractiveText";
import { WordPopup } from "../features/reader/WordPopup";
import { lemma } from "../services/translation";
import { normalize } from "../utils/format";
import { useStudyTimer } from "../hooks/useStudyTimer";
import type { TextDocument } from "../types";
export function ReaderLibrary() {
  const data = useData(["texts"]);
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<TextDocument>();
  const [remove, setRemove] = useState<TextDocument | null>(null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const language = useSettings((s) => s.settings.learningLanguage);
  if (!data) return <Loading />;
  const texts = data.texts.filter(
    (t) =>
      t.language === language &&
      (!favorites || t.favorite) &&
      `${t.title} ${t.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="ЯЗЫК В ЖИВЫХ ИСТОРИЯХ"
        title="Читать и открывать"
        description="Статьи, истории, заметки. Читайте то, что вам интересно."
        actions={
          <button className="button" onClick={() => setParams({ add: "1" })}>
            <Plus size={17} />
            Добавить текст
          </button>
        }
      />
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Найти историю"
        />
        <button
          className={`button ${favorites ? "" : "secondary"}`}
          onClick={() => setFavorites(!favorites)}
        >
          <Star size={15} />
          Избранное
        </button>
      </div>
      {texts.length ? (
        <div className="card-grid">
          {texts.map((t) => (
            <article className="library-card" key={t.id}>
              <div className="card-top">
                <span className="card-symbol">
                  <BookOpen size={23} />
                </span>
                <button
                  className={`icon-button ${t.favorite ? "active" : ""}`}
                  aria-label="Избранный текст"
                  onClick={() =>
                    void perform(() =>
                      TextRepository.save({ ...t, favorite: !t.favorite }),
                    )
                  }
                >
                  <Star size={16} fill={t.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <Link to={`/reader/${t.id}`}>
                <h3>{t.title}</h3>
              </Link>
              <p>
                {t.content.slice(0, 135)}
                {t.content.length > 135 ? "…" : ""}
              </p>
              <div className="card-meta">
                <span>
                  {tokenize(t.content).filter((t) => /[\p{L}]/u.test(t)).length}{" "}
                  слов
                </span>
                <span>{Math.round(t.readingProgress)}% прочитано</span>
              </div>
              <Meter value={t.readingProgress} total={100} />
              <div className="card-footer">
                <Link to={`/reader/${t.id}`}>
                  Читать <ArrowRight size={14} />
                </Link>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label="Редактировать текст"
                    onClick={() => setEdit(t)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Удалить текст"
                    onClick={() => setRemove(t)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="У каждой истории есть новые слова"
          description="Вставьте интересный текст. Нажимайте на незнакомые слова и сохраняйте их в словарь."
          action={
            <button className="button" onClick={() => setParams({ add: "1" })}>
              Добавить первый текст
            </button>
          }
        />
      )}
      {(params.has("add") || edit) && (
        <TextEditor
          text={edit}
          onClose={() => {
            setEdit(undefined);
            setParams({});
          }}
        />
      )}
      {remove && (
        <Confirm
          title="Удалить текст?"
          description="Сохранённые слова останутся в словаре."
          onClose={() => setRemove(null)}
          onConfirm={() =>
            void perform(async () => {
              await TextRepository.delete(remove.id);
              setRemove(null);
            }, "Текст удалён")
          }
        />
      )}
    </>
  );
}
export function ReaderPage() {
  const { id } = useParams();
  const data = useData(["texts", "words"]);
  const { settings: s, update } = useSettings();
  const [selected, setSelected] = useState("");
  const [edit, setEdit] = useState(false);
  const doc = data?.texts.find((t) => t.id === id);
  const article = useRef<HTMLDivElement>(null);
  useStudyTimer("readingMinutes", !!doc);
  useEffect(() => {
    if (doc) void perform(() => remember("reader", doc.id, doc.title));
  }, [doc?.id, doc?.title]);
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const rect = article.current?.getBoundingClientRect();
        if (rect) {
          const progress = Math.min(
            99,
            Math.max(
              0,
              ((window.innerHeight - rect.top) / Math.max(rect.height, 1)) *
                100,
            ),
          );
          void perform(() => TextRepository.progress(id, progress));
        }
      }, 500);
    };
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [id]);
  if (!data) return <Loading />;
  if (!doc)
    return (
      <Empty
        title="Текст не найден"
        description="Он мог быть удалён."
        action={
          <Link to="/reader" className="button">
            Библиотека
          </Link>
        }
      />
    );
  const tokens = tokenize(doc.content).filter((t) => /[\p{L}]/u.test(t));
  const unique = [
    ...new Set(tokens.map((t) => normalize(lemma(t, doc.language)))),
  ];
  const vocabulary = new Map(
    data.words
      .filter((w) => w.language === doc.language)
      .map((w) => [
        normalize(w.term.replace(/^(der|die|das)\s+/i, "")),
        w.status,
      ]),
  );
  const known = unique.filter((t) => vocabulary.get(t) === "mastered").length;
  const learning = unique.filter((t) =>
    ["new", "learning", "review"].includes(vocabulary.get(t) ?? ""),
  ).length;
  return (
    <>
      <Link className="back-link" to="/reader">
        <ArrowLeft size={15} />
        Моя библиотека
      </Link>
      <PageHeading
        title={doc.title}
        description={doc.source || "Слова оживают в контексте."}
        actions={
          <button className="button secondary" onClick={() => setEdit(true)}>
            <Pencil size={15} />
            Редактировать
          </button>
        }
      />
      <div className="reader-toolbar">
        <span>
          <strong>
            {Math.round((known / Math.max(unique.length, 1)) * 100)}%
          </strong>{" "}
          знакомых слов
        </span>
        <span>
          {tokens.length} всего · {unique.length} уникальных · {known} знакомых
          · {learning} изучаемых ·{" "}
          {unique.filter((t) => !vocabulary.has(t)).length} неизвестных
        </span>
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label="Уменьшить шрифт"
            onClick={() => update({ fontSize: Math.max(16, s.fontSize - 1) })}
          >
            A−
          </button>
          <button
            className="icon-button"
            aria-label="Увеличить шрифт"
            onClick={() => update({ fontSize: Math.min(32, s.fontSize + 1) })}
          >
            A+
          </button>
          <button
            className="icon-button"
            aria-label="Тёмный фон чтения"
            onClick={() => update({ readerDark: !s.readerDark })}
          >
            <Moon size={16} />
          </button>
        </div>
      </div>
      <article
        ref={article}
        className={`reader-sheet ${s.readerDark ? "reader-dark" : ""}`}
      >
        <div style={{ maxWidth: s.textWidth, margin: "auto" }}>
          <span className="eyebrow">
            {doc.language.toUpperCase()} · ВАША ИСТОРИЯ
          </span>
          <h2>{doc.title}</h2>
          <InteractiveText
            content={doc.content}
            language={doc.language}
            onSelect={setSelected}
            style={{ fontSize: s.fontSize, lineHeight: s.lineHeight }}
          />
        </div>
      </article>
      <div className="reader-end">
        <p className="hint">
          Нажмите на слово или выделите фразу, чтобы разобрать её.
        </p>
        <button
          className="button"
          onClick={() =>
            void perform(
              () => TextRepository.progress(doc.id, 100),
              "Текст прочитан. Отличная работа!",
            )
          }
        >
          <Check size={16} />
          Прочитано
        </button>
        <Link className="button secondary" to="/learn?mode=review">
          Повторить слова
        </Link>
      </div>
      {selected && (
        <WordPopup
          text={selected}
          context={{
            language: doc.language,
            sourceId: doc.id,
            sourceType: "text",
            sourceTitle: doc.title,
            example:
              doc.content
                .split(/(?<=[.!?])\s/)
                .find((sentence) => sentence.includes(selected)) ?? "",
          }}
          onClose={() => setSelected("")}
        />
      )}
      {edit && <TextEditor text={doc} onClose={() => setEdit(false)} />}
    </>
  );
}
