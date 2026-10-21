import { useSubjectNames } from "../../hooks/useSubjectNames";
import { AutoTextarea } from "../../components/AutoTextarea";
import { useState, type FormEvent } from "react";
import type { TextDocument } from "../../types";
import { Modal } from "../../components/UI";
import { useSettings } from "../../store/useSettings";
import { uid } from "../../utils/format";
import { TextRepository } from "../../services/repositories";
export function TextEditor({
  text,
  onClose,
}: {
  text?: TextDocument;
  onClose: () => void;
}) {
  const languages = useSubjectNames();
  const [doc, setDoc] = useState<TextDocument>(
    text ?? {
      id: uid(),
      title: "",
      content: "",
      language: useSettings.getState().settings.learningLanguage,
      source: "",
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      readingProgress: 0,
      favorite: false,
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await TextRepository.save({
        ...doc,
        title: doc.title.trim(),
        updatedAt: Date.now(),
        readingProgress:
          text?.content === doc.content ? doc.readingProgress : 0,
      });
      onClose();
    } catch {
      setError("Не удалось сохранить текст");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={
        text ? "Редактировать текст" : "История, которую хочется прочитать"
      }
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className="form-grid">
          <label>
            Название
            <input
              required
              value={doc.title}
              onChange={(e) => setDoc({ ...doc, title: e.target.value })}
            />
          </label>
          <label>
            Язык
            <select
              value={doc.language}
              onChange={(e) =>
                setDoc({
                  ...doc,
                  language: e.target.value as TextDocument["language"],
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
        </div>
        <label>
          Текст
          <AutoTextarea
            required
            rows={12}
            value={doc.content}
            onChange={(e) => setDoc({ ...doc, content: e.target.value })}
            placeholder="Вставьте статью, историю или собственный текст…"
          />
        </label>
        <div className="form-grid">
          <label>
            Источник
            <input
              value={doc.source}
              onChange={(e) => setDoc({ ...doc, source: e.target.value })}
            />
          </label>
          <label>
            Теги
            <input
              value={doc.tags.join(", ")}
              onChange={(e) =>
                setDoc({
                  ...doc,
                  tags: e.target.value.split(",").map((t) => t.trim()),
                })
              }
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            className="button"
            disabled={busy || !doc.content.trim() || !doc.title.trim()}
          >
            Сохранить текст
          </button>
        </div>
      </form>
    </Modal>
  );
}
