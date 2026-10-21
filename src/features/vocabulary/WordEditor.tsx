import { AnswerAlternatives } from "../../components/AnswerAlternatives";
import { useSubjectNames } from "../../hooks/useSubjectNames";
import { AutoTextarea } from "../../components/AutoTextarea";
import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { Modal } from "../../components/UI";
import { useUI } from "../../store/useUI";
import { useSettings } from "../../store/useSettings";
import { newWord } from "../../services/wordModel";
import { WordRepository } from "../../services/repositories";
import { statusNames } from "../../utils/format";
import type { Word } from "../../types";
export function WordEditorHost() {
  const draft = useUI((s) => s.wordDraft);
  return draft ? (
    <WordEditor key={draft.id ?? JSON.stringify(draft)} draft={draft} />
  ) : null;
}
function WordEditor({ draft }: { draft: Partial<Word> }) {
  const languages = useSubjectNames();
  const { settings } = useSettings();
  const { closeWord, toast } = useUI();
  const [word, setWord] = useState(() =>
    newWord({
      language: settings.learningLanguage,
      nativeLanguage: settings.nativeLanguage,
      ...draft,
    }),
  );
  const [deckId, setDeckId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const decks = useLiveQuery(() => db.decks.toArray(), []) ?? [];
  const patch = <K extends keyof Word>(key: K, value: Word[K]) =>
    setWord((w) => ({ ...w, [key]: value }));
  async function save(event: FormEvent, another = false) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await WordRepository.save(word, deckId);
      toast(draft.id ? "Изменения сохранены" : "Слово добавлено");
      if (another)
        setWord(
          newWord({
            language: word.language,
            nativeLanguage: word.nativeLanguage,
          }),
        );
      else closeWord();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }
  const field = (key: keyof Word, title: string, required = false) => (
    <label key={key}>
      {title}
      <input
        required={required}
        value={String(word[key] ?? "")}
        onChange={(e) => patch(key, e.target.value as never)}
      />
    </label>
  );
  return (
    <Modal
      wide
      title={
        draft.id ? "Редактировать слово" : "Новое слово, новая возможность"
      }
      onClose={closeWord}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          {field("term", "Слово или выражение *", true)}
          {field("translation", "Перевод *", true)}
          <label>
            Язык
            <select
              value={word.language}
              onChange={(e) =>
                patch("language", e.target.value as Word["language"])
              }
            >
              {Object.entries(languages).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Добавить в колоду
            <select value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              <option value="">Без добавления в колоду</option>
              {decks
                .filter((d) => d.language === word.language)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </label>
          {field("example", "Пример предложения")}
          {field("partOfSpeech", "Часть речи")}
          <label>
            Тип
            <select
              value={word.type}
              onChange={(e) => patch("type", e.target.value as Word["type"])}
            >
              {Object.entries({
                word: "Слово",
                phrase: "Фраза",
                idiom: "Идиома",
                collocation: "Словосочетание",
                "phrasal verb": "Фразовый глагол",
                sentence: "Предложение",
              }).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Теги (через запятую)
            <input
              value={word.tags.join(", ")}
              onChange={(e) =>
                patch(
                  "tags",
                  e.target.value.split(",").map((t) => t.trim()),
                )
              }
            />
          </label>
        </div>
        <AnswerAlternatives
          value={word}
          onChange={(value) => setWord((current) => ({ ...current, ...value }))}
        />
        <details>
          <summary>Определение, грамматика и дополнительные поля</summary>
          <div className="form-grid">
            {field("definition", "Определение")}
            {field("pronunciation", "Произношение")}
            {field("ipa", "IPA")}
            {word.language === "de" && (
              <>
                {field("article", "Артикль")}
                {field("gender", "Род")}
                {field("plural", "Множественное число")}
                {field(
                  "verbForms",
                  "Infinitiv · Präsens · Präteritum · Partizip II · Hilfsverb",
                )}
                {field("preposition", "Предлог")}
                {field("grammaticalCase", "Падеж")}
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={word.separable}
                    onChange={(e) => patch("separable", e.target.checked)}
                  />
                  Отделяемая приставка
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={word.reflexive}
                    onChange={(e) => patch("reflexive", e.target.checked)}
                  />
                  Возвратный глагол
                </label>
              </>
            )}
            {field("synonyms", "Синонимы")}
            {field("antonyms", "Антонимы")}
            <label>
              Статус
              <select
                value={word.status}
                onChange={(e) =>
                  patch("status", e.target.value as Word["status"])
                }
              >
                {Object.entries(statusNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Сложность
              <select
                value={word.difficulty}
                onChange={(e) => patch("difficulty", Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Заметки
              <AutoTextarea
                value={word.notes}
                onChange={(e) => patch("notes", e.target.value)}
              />
            </label>
          </div>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={closeWord}
          >
            Отмена
          </button>
          {!draft.id && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || !word.term.trim() || !word.translation.trim()}
              onClick={(e) => void save(e, true)}
            >
              Сохранить и ещё
            </button>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
