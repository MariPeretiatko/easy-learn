import { SetCardEditor } from "../features/sets/SetCardEditor";
import { useSetDraft } from "../features/sets/useSetDraft";
import { blankCard, swapCardSides } from "../features/sets/editorModel";
import { SetImportDialog } from "../features/sets/SetImportDialog";
import { useSubjectNames } from "../hooks/useSubjectNames";
import { AutoTextarea } from "../components/AutoTextarea";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  LockKeyhole,
  Plus,
  RotateCcw,
  Trash2,
  Search,
  Keyboard,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import { db } from "../db/database";
import { useLiveQuery } from "dexie-react-hooks";
import type { SetDraft } from "../types";
import { Loading, Modal, Confirm } from "../components/UI";
export function SetEditorPage() {
  const languages = useSubjectNames();
  const { draft, saved, error, busy, patch, cardPatch, move, publish } =
    useSetDraft();
  const [importing, setImporting] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [help, setHelp] = useState(false);
  const [clearing, setClearing] = useState(false);
  const dictionaryWords =
    useLiveQuery(
      () =>
        draft
          ? db.words.where("language").equals(draft.language).toArray()
          : [],
      [draft?.language],
    ) ?? [];
  if (!draft)
    return error ? <p className="form-error">{error}</p> : <Loading />;
  const dictionary = dictionaryWords.filter(
    (word) =>
      word.language === draft.language &&
      word.nativeLanguage === draft.nativeLanguage,
  );
  return (
    <div
      className="set-editor-page"
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key === "Enter" &&
          !(event.target as HTMLElement).closest("dialog")
        ) {
          event.preventDefault();
          patch({ cards: [...draft.cards, blankCard()] });
        }
      }}
    >
      <div className="set-editor-title">
        <h1>
          {draft.sourceDeckId ? "Редактировать колоду" : "Создать карточки"}
        </h1>
        <div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void publish()}
          >
            Сохранить колоду
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => void publish(true)}
          >
            Сохранить и учить
          </button>
        </div>
      </div>
      {draft.sourceDeckId && (
        <p className="hint shared-card-note">
          Карточки общие для словаря и колод. Изменения текста и изображений
          появятся везде; удаление строки убирает карточку только из этой
          колоды.
        </p>
      )}
      <div className="set-editor-meta">
        <span className="set-private-badge">
          <LockKeyhole size={16} />
          Личная колода
        </span>
        <span
          className={`autosave-status ${saved ? "saved" : ""}`}
          aria-live="polite"
        >
          {saved ? <Check size={16} /> : <RotateCcw size={15} />}{" "}
          {saved ? "Все изменения сохранены" : "Сохранение…"}
        </span>
        <Link className="text-link editor-back" to="/library">
          <ArrowLeft size={16} />
          Назад в библиотеку
        </Link>
      </div>
      <fieldset disabled={busy} className="set-page-fields">
        <label className="set-title-field">
          <span>Название</span>
          <input
            aria-label="Название колоды"
            value={draft.title}
            placeholder="Название"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <label className="set-description-field">
          <span>Описание</span>
          <AutoTextarea
            aria-label="Описание колоды"
            value={draft.description}
            placeholder="Добавьте описание…"
            rows={1}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
        <div className="set-tools">
          <div className="set-tools-primary">
            <button
              className="button secondary"
              type="button"
              onClick={() => setImporting(true)}
            >
              <Plus size={17} />
              Импортировать
            </button>
            <details className="editor-language-details">
              <summary>
                {languages[draft.language]} →{" "}
                {{ ru: "Русский", uk: "Украинский", ...languages }[
                  draft.nativeLanguage
                ] ?? draft.nativeLanguage}
                <ChevronDown size={15} />
              </summary>
              <div className="editor-language-row">
                <label>
                  Термины
                  <select
                    aria-label="Язык терминов"
                    disabled={!!draft.sourceDeckId}
                    value={draft.language}
                    onChange={(e) =>
                      patch({
                        language: e.target.value as SetDraft["language"],
                      })
                    }
                  >
                    {Object.entries(languages).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Определения
                  <select
                    aria-label="Язык определений"
                    value={draft.nativeLanguage}
                    onChange={(e) => patch({ nativeLanguage: e.target.value })}
                  >
                    <option value="ru">Русский</option>
                    <option value="uk">Украинский</option>
                    {Object.entries(languages).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          </div>
          <div className="set-tools-secondary">
            <label className="suggestions-toggle">
              Предложения
              <input
                type="checkbox"
                role="switch"
                checked={suggestions}
                onChange={(e) => setSuggestions(e.target.checked)}
              />
            </label>
            <button
              className={`icon-button ${searching ? "selected" : ""}`}
              type="button"
              aria-label="Найти карточку в редакторе"
              aria-expanded={searching}
              onClick={() => {
                setSearching((v) => !v);
                setSearchQuery("");
              }}
            >
              <Search size={19} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Поменять термины и определения местами"
              onClick={() =>
                patch({
                  cards: draft.cards.map(swapCardSides),
                })
              }
            >
              <ArrowLeftRight size={19} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="Горячие клавиши"
              onClick={() => setHelp(true)}
            >
              <Keyboard size={20} />
            </button>
            <button
              className="icon-button clear-cards-button"
              type="button"
              aria-label="Очистить карточки"
              onClick={() => setClearing(true)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        {searching && (
          <input
            className="editor-search"
            aria-label="Поиск карточек в редакторе"
            autoFocus
            placeholder="Найти термин или определение"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        )}
        <div className="editor-card-list">
          {draft.cards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) =>
              `${card.term} ${card.definition}`
                .toLowerCase()
                .includes(searchQuery.trim().toLowerCase()),
            )
            .map(({ card, index }) => (
              <SetCardEditor
                key={card.id}
                card={card}
                index={index}
                isLast={index === draft.cards.length - 1}
                dragging={dragged === card.id}
                dictionary={dictionary}
                suggestions={suggestions}
                onPatch={(value) => cardPatch(card.id, value)}
                onMove={(offset) => move(card.id, offset)}
                onRemove={() =>
                  patch({
                    cards: draft.cards.filter((item) => item.id !== card.id),
                  })
                }
                onDragStart={() => setDragged(card.id)}
                onDragEnd={() => setDragged(null)}
                onDrop={() => {
                  if (!dragged || dragged === card.id) return;
                  const cards = [...draft.cards];
                  const from = cards.findIndex((item) => item.id === dragged);
                  const to = cards.findIndex((item) => item.id === card.id);
                  if (from >= 0) {
                    const [moving] = cards.splice(from, 1);
                    cards.splice(to, 0, moving);
                    patch({ cards });
                  }
                  setDragged(null);
                }}
              />
            ))}
        </div>
        <button
          type="button"
          className="editor-add-card"
          onClick={() => {
            patch({ cards: [...draft.cards, blankCard()] });
            setSearchQuery("");
          }}
        >
          <Plus size={19} />
          Добавить карточку
        </button>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-bottom-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void publish()}
        >
          Сохранить колоду
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => void publish(true)}
        >
          {busy ? "Сохранение…" : "Сохранить и учить"}
        </button>
      </div>
      {help && (
        <Modal title="Горячие клавиши" onClose={() => setHelp(false)}>
          <div className="shortcut-list">
            <p>
              <kbd>Tab</kbd> Следующее поле
            </p>
            <p>
              <kbd>Shift + Tab</kbd> Предыдущее поле
            </p>
            <p>
              <kbd>Ctrl / ⌘ + Enter</kbd> Добавить карточку
            </p>
          </div>
          <button className="button" onClick={() => setHelp(false)}>
            Понятно
          </button>
        </Modal>
      )}
      {clearing && (
        <Confirm
          title="Очистить все карточки?"
          description="Все термины и определения в этом черновике будут удалены."
          onClose={() => setClearing(false)}
          onConfirm={() => {
            patch({ cards: [blankCard(), blankCard()] });
            setClearing(false);
          }}
        />
      )}
      {importing && (
        <SetImportDialog
          onClose={() => setImporting(false)}
          onImport={(cards, replace) =>
            patch({
              cards: replace
                ? cards
                : [
                    ...draft.cards.filter(
                      (card) => card.term.trim() || card.definition.trim(),
                    ),
                    ...cards,
                  ],
            })
          }
        />
      )}
    </div>
  );
}
