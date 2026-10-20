import { useState } from "react";
import { Modal } from "../../components/UI";
import { useData } from "../../hooks/useData";
import { parseCSV, type CsvWord } from "../../services/csv";
import { newWord, WordRepository } from "../../services/repositories";
import { useSettings } from "../../store/useSettings";
import { useUI } from "../../store/useUI";
import { db } from "../../db/database";
import { normalize } from "../../utils/format";
export function ImportCSV({ onClose }: { onClose: () => void }) {
  const data = useData();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<CsvWord[]>([]);
  const [deck, setDeck] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { settings } = useSettings();
  function preview() {
    try {
      setRows(parseCSV(text));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать CSV");
      setRows([]);
    }
  }
  async function save() {
    setBusy(true);
    try {
      let added = 0,
        skipped = 0;
      await db.transaction(
        "rw",
        db.words,
        db.decks,
        db.statistics,
        async () => {
          const existing = new Set(
            (
              await db.words
                .where("language")
                .equals(settings.learningLanguage)
                .toArray()
            ).map((w) => normalize(w.term)),
          );
          for (const row of rows) {
            if (existing.has(normalize(row.term))) {
              skipped++;
              continue;
            }
            await WordRepository.save(
              newWord({
                ...row,
                language: settings.learningLanguage,
                nativeLanguage: settings.nativeLanguage,
              }),
              deck || undefined,
            );
            existing.add(normalize(row.term));
            added++;
          }
        },
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
        <textarea
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
