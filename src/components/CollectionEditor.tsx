import { collectionsForLanguage } from "../services/libraryScope";
import { useSubjectNames } from "../hooks/useSubjectNames";
import { AutoTextarea } from "./AutoTextarea";
import { useState } from "react";
import { Modal } from "./UI";
import type { Collection, Deck } from "../types";
import { useSettings } from "../store/useSettings";
import { uid } from "../utils/format";
import { saveCollection } from "../services/collections";
export const collectionNames = {
  folder: "папку",
  course: "модуль",
};
export function CollectionEditor({
  collection,
  kind = "folder",
  decks,
  onClose,
  onSaved,
  collections = [],
  parentFolderId,
}: {
  collection?: Collection;
  collections?: Collection[];
  parentFolderId?: string;
  kind?: Exclude<Collection["kind"], "class">;
  decks: Deck[];
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const languages = useSubjectNames();
  const language = useSettings((state) => state.settings.learningLanguage);
  const [value, setValue] = useState<Collection>(
    collection
      ? {
          ...collection,
          language:
            collection.language ??
            decks.find((deck) => collection.deckIds.includes(deck.id))
              ?.language ??
            language,
        }
      : {
          id: uid(),
          kind,
          language,
          ...(kind === "course" ? { folderId: parentFolderId } : {}),
          title: "",
          description: "",
          deckIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`${collection ? "Редактировать" : "Создать"} ${collectionNames[value.kind === "class" ? "folder" : value.kind]}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void saveCollection(value)
            .then(() => {
              if (value.kind === "course" && value.language)
                useSettings
                  .getState()
                  .update({ learningLanguage: value.language });
              onSaved?.(value.id);
              onClose();
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Название
          <input
            required
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
            placeholder={
              value.kind === "class"
                ? "Например, Немецкий A1"
                : "Введите название"
            }
          />
        </label>
        {(value.kind !== "folder" || !!collection) && (
          <>
            <label>
              Описание
              <AutoTextarea
                value={value.description}
                onChange={(e) =>
                  setValue({ ...value, description: e.target.value })
                }
              />
            </label>
            {value.kind === "course" && (
              <label>
                Язык модуля
                <select
                  aria-label="Язык модуля"
                  value={value.language ?? language}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      language: event.target.value as typeof language,
                      deckIds: [],
                      folderId: undefined,
                    })
                  }
                >
                  {Object.entries(languages).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {value.kind === "course" && (
              <label>
                Папка
                <select
                  value={value.folderId ?? ""}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      folderId: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">Без папки</option>
                  {collectionsForLanguage(
                    collections,
                    decks,
                    value.language ?? language,
                  )
                    .filter((item) => item.kind === "folder")
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.title}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <h3>Добавить колоды</h3>
            <div className="collection-set-picker">
              {decks.length ? (
                decks
                  .filter((deck) => deck.language === value.language)
                  .map((deck) => (
                    <label className="check-label" key={deck.id}>
                      <input
                        type="checkbox"
                        checked={value.deckIds.includes(deck.id)}
                        onChange={(e) =>
                          setValue({
                            ...value,
                            deckIds: e.target.checked
                              ? [...value.deckIds, deck.id]
                              : value.deckIds.filter((id) => id !== deck.id),
                          })
                        }
                      />
                      <span>
                        {deck.title}
                        <small>
                          {languages[deck.language]} · {deck.wordIds.length}{" "}
                          карточек
                        </small>
                      </span>
                    </label>
                  ))
              ) : (
                <p className="muted">
                  Создайте первую колоду, чтобы добавить его сюда.
                </p>
              )}
            </div>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button" disabled={busy || !value.title.trim()}>
            {collection ? "Сохранить" : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
