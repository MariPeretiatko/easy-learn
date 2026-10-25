import { flushPendingWrites } from "../services/pendingWrites";
import { currentDatabase } from "../db/database";
import { perform } from "../store/useUI";
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Download, WifiOff } from "lucide-react";
import { useUI } from "../store/useUI";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export function OfflineStatus() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      useUI
        .getState()
        .toast(
          "Офлайн-кэш не настроен. Приложение продолжит работать онлайн.",
          true,
        ),
  });
  useEffect(() => {
    const onOnline = () => setOffline(false),
      onOffline = () => setOffline(true);
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);
  useEffect(() => {
    if (offlineReady) {
      useUI.getState().toast("Приложение готово к работе офлайн");
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);
  return (
    <>
      {offline && (
        <div className="offline-banner">
          <WifiOff size={15} />
          Вы офлайн. Словарь, карточки и тексты доступны.
        </div>
      )}
      {needRefresh && (
        <div className="update-banner">
          <span>Доступна новая версия. Сохраните открытые изменения.</span>
          <button
            onClick={() =>
              void perform(async () => {
                await flushPendingWrites();
                const database = currentDatabase();
                await database.transaction(
                  "rw",
                  database.tables,
                  async () => undefined,
                );
                await updateServiceWorker(true);
              })
            }
          >
            Обновить
          </button>
          <button onClick={() => setNeedRefresh(false)}>Позже</button>
        </div>
      )}
      {install && (
        <button
          className="install-button"
          onClick={() => {
            void install
              .prompt()
              .then(() => install.userChoice)
              .then(() => setInstall(null));
          }}
        >
          <Download size={15} />
          Установить приложение
        </button>
      )}
    </>
  );
}
