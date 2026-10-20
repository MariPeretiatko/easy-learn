import { useState, type FormEvent } from "react";
import { Modal } from "../../components/UI";
import type { Deck } from "../../types";
import { useSettings } from "../../store/useSettings";
import { DeckRepository } from "../../services/repositories";
import { uid, languages } from "../../utils/format";
export function DeckEditor({
  deck,
  onClose,
}: {
  deck?: Deck;
  onClose: () => void;
}) {
  const [d, setD] = useState<Deck>(
    deck ?? {
      id: uid(),
      title: "",
      description: "",
      language: useSettings.getState().settings.learningLanguage,
      tags: [],
      wordIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await DeckRepository.save({
        ...d,
        title: d.title.trim(),
        tags: d.tags.filter(Boolean),
        updatedAt: Date.now(),
      });
      onClose();
    } catch {
      setError("Не удалось сохранить колоду");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={deck ? "Редактировать колоду" : "Соберите свою колоду"}
      onClose={onClose}
    >
      <form onSubmit={save}>
        <label>
          Название
          <input
            required
            value={d.title}
            onChange={(e) => setD({ ...d, title: e.target.value })}
          />
        </label>
        <label>
          Описание
          <textarea
            value={d.description}
            onChange={(e) => setD({ ...d, description: e.target.value })}
          />
        </label>
        <label>
          Язык
          <select
            disabled={!!deck?.wordIds.length}
            value={d.language}
            onChange={(e) =>
              setD({ ...d, language: e.target.value as Deck["language"] })
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
          Теги
          <input
            value={d.tags.join(", ")}
            onChange={(e) =>
              setD({
                ...d,
                tags: e.target.value.split(",").map((t) => t.trim()),
              })
            }
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button disabled={busy || !d.title.trim()} className="button">
            Сохранить колоду
          </button>
        </div>
      </form>
    </Modal>
  );
}
