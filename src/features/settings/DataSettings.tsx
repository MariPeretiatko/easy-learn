import { currentDatabase } from "../../db/database";
import { useAccount } from "../../cloud/auth";
import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Modal, Confirm } from "../../components/UI";
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type Backup,
} from "../../services/backup";
import { download, vocabularyCSV } from "../../services/csv";
import { clearData } from "../../services/repositories";
import { useData } from "../../hooks/useData";
import { defaultSettings } from "../../store/settingsDefaults";
import { useSettings } from "../../store/useSettings";
import { perform, reportError } from "../../store/useUI";
export function DataSettings() {
  const database = currentDatabase();
  const user = useAccount((s) => s.user);
  const data = useData(["words"]);
  const [clear, setClear] = useState(false);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const { update } = useSettings();
  return (
    <>
      <section className="panel">
        <h2>Ваши данные</h2>
        <p className="hint">
          {user
            ? "Библиотека хранится на устройстве и синхронизируется с вашим аккаунтом. Проверяйте статус синхронизации перед сменой устройства. Восстановление JSON заменяет библиотеку этого аккаунта, включая облачную копию после синхронизации."
            : "Библиотека хранится в этом браузере. Сохраните резервную копию перед сменой браузера или устройства."}
        </p>
        <div className="data-actions">
          <button
            className="button secondary"
            onClick={() =>
              void perform(async () =>
                download(
                  "easy-learn-backup.json",
                  JSON.stringify(await createBackup(), null, 2),
                ),
              )
            }
          >
            <Download size={15} />
            Экспорт JSON
          </button>
          <button
            className="button secondary"
            onClick={() =>
              download(
                "easy-learn-vocabulary.csv",
                vocabularyCSV(data?.words ?? []),
                "text/csv;charset=utf-8",
              )
            }
          >
            Словарь CSV
          </button>
        </div>
        <label>
          Восстановить из JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) {
                void file
                  .text()
                  .then((text) => setBackup(parseBackup(text)))
                  .catch(reportError);
              }
            }}
          />
        </label>
        <button className="button danger" onClick={() => setClear(true)}>
          Удалить все данные
        </button>
      </section>
      {clear && (
        <Confirm
          title={
            user ? "Удалить библиотеку аккаунта?" : "Удалить всю библиотеку?"
          }
          description="Будут удалены слова, колоды, тексты, видео, история и настройки. Это действие нельзя отменить. Сначала экспортируйте резервную копию."
          onClose={() => setClear(false)}
          onConfirm={() =>
            void perform(async () => {
              await clearData();
              if (currentDatabase() === database) update(defaultSettings);
              setClear(false);
            }, "Все данные удалены")
          }
        />
      )}
      {backup && (
        <Modal
          title="Восстановить резервную копию?"
          onClose={() => {
            if (!busy) setBackup(null);
          }}
        >
          <p>
            В копии: {backup.words.length} слов, {backup.decks.length} колод,{" "}
            {backup.texts.length} текстов, {backup.videos.length} видео.
          </p>
          <p className="notice">
            Текущая библиотека и настройки будут полностью заменены данными из
            файла.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setBackup(null)}
            >
              Отмена
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void perform(async () => {
                  try {
                    await restoreBackup(backup);
                    setBackup(null);
                  } finally {
                    setBusy(false);
                  }
                }, "Резервная копия восстановлена");
              }}
            >
              <Upload size={15} />
              {busy ? "Восстановление…" : "Заменить и восстановить"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
