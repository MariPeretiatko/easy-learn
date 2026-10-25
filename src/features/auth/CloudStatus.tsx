import { useEffect, useState } from "react";
import { LearningDatabase } from "../../db/database";
import { useLiveQuery } from "dexie-react-hooks";
import { currentDatabase } from "../../db/database";
import { Link } from "react-router-dom";
import { useAccount } from "../../cloud/auth";
import { syncNow, useSync } from "../../cloud/sync";
export function CloudStatus() {
  const user = useAccount((s) => s.user),
    { state, message } = useSync();
  const database = currentDatabase();
  const pending = useLiveQuery(
    () => (database.owner ? database.outbox.count() : 0),
    [database.name],
  );
  const [offer, setOffer] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const imported = useLiveQuery(async () => {
    if (!database.owner) return false;
    return (
      !!(await database.syncMeta.get("guestImport"))?.value ||
      !!(await database.preferences.get(
        `guestImport:${localStorage.getItem("easy-learn-device-id")}`,
      ))
    );
  }, [database.name]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const guest = new LearningDatabase();
    void (async () => {
      const personalWord = await guest.words
        .filter(
          (word) =>
            !word.id.startsWith("catalog-") ||
            word.reviewCount > 0 ||
            word.favorite ||
            !!word.notes,
        )
        .first();
      const personalDeck = await guest.decks
        .filter((deck) => !deck.id.startsWith("deutsch-") || deck.favorite)
        .first();
      const materials =
        (await guest.texts.count()) +
        (await guest.videos.count()) +
        (await guest.drafts.count());
      if (active) setOffer(!!personalWord || !!personalDeck || materials > 0);
    })()
      .catch(() => undefined)
      .finally(() => guest.close());
    return () => {
      active = false;
    };
  }, [user?.id]);
  if (!user) return null;
  const label = {
    local: "Сохранено на устройстве",
    syncing: "Синхронизация…",
    saved: "Сохранено в облаке",
    error: "Облако недоступно",
    conflict: "Нужно выбрать версию",
  }[state === "saved" && pending ? "local" : state];
  return (
    <div className="cloud-status" role="status">
      <span>{label}</span>
      {offer && !dismissed && !imported && (
        <span>
          На устройстве есть локальные материалы.{" "}
          <Link to="/settings">Перенести в аккаунт</Link>{" "}
          <button onClick={() => setDismissed(true)}>Позже</button>
        </span>
      )}
      {message && <span>{message}</span>}
      <button className="button secondary" onClick={() => void syncNow()}>
        Синхронизировать
      </button>
      {state === "conflict" && <Link to="/settings">Открыть настройки</Link>}
    </div>
  );
}
