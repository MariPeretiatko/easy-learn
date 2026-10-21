import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Modal } from "../../components/UI";
import { AutoTextarea } from "../../components/AutoTextarea";
import type { SetCard } from "../../types";
import { parseCardImport } from "./editorModel";
export function SetImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (cards: SetCard[], replace: boolean) => void;
}) {
  const [importText, setImportText] = useState("");
  const [delimiter, setDelimiter] = useState("tab");
  const [replace, setReplace] = useState(false);
  const [fileError, setFileError] = useState("");
  const imported = useMemo(
    () => parseCardImport(importText, delimiter),
    [importText, delimiter],
  );
  return (
    <Modal wide title="Импортировать данные" onClose={() => onClose()}>
      <p className="muted">
        Скопируйте данные из Word, Excel, Google Docs или вставьте CSV.
      </p>
      <AutoTextarea
        className="import-set-text"
        aria-label="Данные для импорта"
        placeholder={"термин\tопределение\nтермин\tопределение"}
        rows={8}
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
      />
      <div className="form-grid">
        <label>
          Между термином и определением
          <select
            aria-label="Разделитель терминов"
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value)}
          >
            <option value="tab">Табуляция</option>
            <option value=",">Запятая</option>
            <option value=";">Точка с запятой</option>
            <option value=" - ">Тире</option>
            <option value="auto">CSV — автоматически</option>
          </select>
        </label>
        <label className="file-import-label">
          <Upload size={18} />
          Открыть файл
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void file
                  .text()
                  .then(setImportText)
                  .catch((error) =>
                    setFileError(
                      error instanceof Error
                        ? error.message
                        : "Не удалось прочитать файл",
                    ),
                  );
            }}
          />
        </label>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
        />
        Заменить текущие карточки
      </label>
      {fileError && (
        <p className="form-error" role="alert">
          {fileError}
        </p>
      )}
      {imported.error ? (
        <p className="form-error">{imported.error}</p>
      ) : (
        <div className="import-preview">
          <strong>Предпросмотр: {imported.cards.length} карточек</strong>
          {imported.cards.slice(0, 5).map((card) => (
            <div key={card.id}>
              <span>{card.term}</span>
              <span>{card.definition}</span>
            </div>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={() => onClose()}>
          Отмена
        </button>
        <button
          className="button"
          disabled={!imported.cards.length}
          onClick={() => {
            onImport(imported.cards, replace);
            onClose();
          }}
        >
          Импортировать {imported.cards.length} карточек
        </button>
      </div>
    </Modal>
  );
}
