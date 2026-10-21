import { useState } from "react";
import { Modal } from "./UI";
import { addStudySubject, updateStudySubject } from "../services/subjects";
import type { StudySubject } from "../types";
export function SubjectEditor({
  onClose,
  subject,
}: {
  onClose: () => void;
  subject?: StudySubject;
}) {
  const [kind, setKind] = useState<StudySubject["kind"]>(
    subject?.kind ?? "language",
  );
  const [name, setName] = useState(subject?.name ?? "");
  const [code, setCode] = useState(subject?.speechCode ?? "");
  const [error, setError] = useState("");
  return (
    <Modal
      title={subject ? "Изменить язык или тему" : "Добавить язык или тему"}
      onClose={onClose}
    >
      <form
        className="subject-editor"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            if (subject)
              updateStudySubject({
                id: subject.id,
                name: name.trim(),
                kind,
                ...(code.trim() && kind === "language"
                  ? { speechCode: code.trim() }
                  : {}),
              });
            else addStudySubject(name, kind, code);
            onClose();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Не удалось добавить раздел",
            );
          }
        }}
      >
        <div className="subject-kind-options">
          {(
            [
              ["language", "Язык"],
              ["topic", "Общая тема"],
            ] as const
          ).map(([value, label]) => (
            <label className="check-label" key={value}>
              <input
                disabled={!!subject}
                type="radio"
                name="subject-kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              {label}
            </label>
          ))}
        </div>
        <label>
          Название
          <input
            value={name}
            required
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              kind === "language"
                ? "Например, Итальянский"
                : "Например, История или Биология"
            }
          />
        </label>
        <p className="hint">
          {kind === "language"
            ? "Создавайте модули и колоды для любого языка."
            : "Учите термины, определения, даты и другие материалы по выбранной теме."}
        </p>
        {kind === "language" && (
          <details>
            <summary>Произношение (необязательно)</summary>
            <label>
              Код языка для озвучки
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Например, it или ja"
              />
            </label>
          </details>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button" disabled={!name.trim()}>
            {subject ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
