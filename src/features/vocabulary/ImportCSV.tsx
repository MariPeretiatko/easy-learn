import { importVocabulary } from "../../services/importVocabulary";
import { AutoTextarea } from "../../components/AutoTextarea";
import { useState } from "react";
import { Modal } from "../../components/UI";
import { useData } from "../../hooks/useData";
import { parseCSV, type CsvWord } from "../../services/csv";
import { useSettings } from "../../store/useSettings";
import { useUI } from "../../store/useUI";
export function ImportCSV({ onClose }: { onClose: () => void }) {
  const data = useData(["decks"]);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<CsvWord[]>([]);
  const [deck, setDeck] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [separator, setSeparator] = useState("");
  const { settings } = useSettings();
  function preview() {
    try {
      setRows(parseCSV(text, separator || undefined));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать CSV");
      setRows([]);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const { added, skipped } = await importVocabulary(
        rows,
        settings.learningLanguage,
        settings.nativeLanguage,
        deck || undefined,
      );
      useUI
        .getState()
        .toast(`Импортировано: ${added}. Пропущено дублей: ${skipped}.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось импортировать");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal wide title="Импорт слов из CSV" onClose={onClose}>
      <p className="hint">
        Формат: word,translation. Дополнительно: example,tags. Теги разделяются
        |. Дубли будут пропущены.
      </p>
      <label>
        Выберите файл
        <input
          type="file"
          accept=".csv,.tsv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 20_000_000) {
                setError("Файл слишком большой (максимум 20 МБ)");
                return;
              }
              void file
                .text()
                .then((value) => {
                  setText(value);
                  setRows([]);
                })
                .catch(() => setError("Не удалось прочитать файл"));
            }
          }}
        />
      </label>
      <label>
        Или вставьте CSV
        <AutoTextarea
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRows([]);
          }}
          placeholder={"word,translation\nHund,собака\nKatze,кошка"}
        />
      </label>
      <label>
        Разделитель столбцов
        <select
          value={separator}
          onChange={(event) => {
            setSeparator(event.target.value);
            setRows([]);
          }}
        >
          <option value="">Определить автоматически</option>
          <option value={"\t"}>Табуляция (TSV)</option>
          <option value=",">Запятая</option>
          <option value=";">Точка с запятой</option>
        </select>
      </label>
      <label>
        Добавить в колоду
        <select value={deck} onChange={(e) => setDeck(e.target.value)}>
          <option value="">Без колоды</option>
          {data?.decks
            .filter((d) => d.language === settings.learningLanguage)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
        </select>
      </label>
      {rows.length > 0 && (
        <>
          <p className="hint">
            Готово к импорту: {rows.length} строк. Предпросмотр первых 20:
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Слово</th>
                  <th>Перевод</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{r.term}</td>
                    <td>{r.translation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Отмена
        </button>
        <button
          className="button secondary"
          disabled={!text.trim() || busy}
          onClick={preview}
        >
          Предпросмотр
        </button>
        <button
          className="button"
          disabled={!rows.length || busy}
          onClick={() => void save()}
        >
          {busy ? "Импорт…" : "Импортировать"}
        </button>
      </div>
    </Modal>
  );
}
