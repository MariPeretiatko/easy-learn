import { clearDraftJournals } from "../services/draftRecovery";
import { flushPendingWrites } from "../services/pendingWrites";
import { useEffect, useState, type ReactNode } from "react";
import { currentDatabase, selectDatabase } from "../db/database";
import { importPreparedGermanLibrary } from "../services/libraryImport";
import { supabase } from "./client";
import { signOut, useAccount } from "./auth";
import { observePreferences, selectPreferences } from "./preferences";
import { startSync, useSync } from "./sync";
import { useUI } from "../store/useUI";
let transition = Promise.resolve();
export function CloudRoot({ children }: { children: ReactNode }) {
  const { user, ready, generation, error } = useAccount();
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const requested = () => setDeleting(true);
    window.addEventListener("account-deletion-requested", requested);
    return () =>
      window.removeEventListener("account-deletion-requested", requested);
  }, []);
  const desired = `${user?.id ?? "guest"}:${generation}`;
  useEffect(() => {
    if (!ready) return;
    setFailure("");
    setDeleting(false);
    let active = true;
    let stopSync: () => void = () => undefined,
      stopPreferences: () => void = () => undefined;
    // The previous keyed workspace unmounts before this queued transition.
    // Its draft flush writes to its captured database, then the barrier drains it.
    transition = transition
      .catch(() => undefined)
      .then(async () => {
        if (!active) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (!active) return;
        await flushPendingWrites();
        useUI.setState({ wordDraft: null, toasts: [] });
        await selectDatabase(user?.id ?? null);
        const database = currentDatabase();
        if (user && supabase) {
          let pending = !!(
            await database.syncMeta.get("accountDeletionPending")
          )?.value;
          if (navigator.onLine) {
            const response = await supabase
              .rpc("account_deletion_pending")
              .abortSignal(AbortSignal.timeout(3000));
            if (!response.error) pending = response.data;
          }
          if (!active) return;
          setDeleting(pending);
          if (pending) {
            setWorkspace(desired);
            return;
          }
        }
        await selectPreferences(user?.id ?? null);
        await importPreparedGermanLibrary();
        if (!active) return;
        stopPreferences = observePreferences();
        stopSync = startSync(database);
        useSync.setState({ state: "local", message: "" });
        setWorkspace(desired);
      })
      .catch((e) => {
        if (active)
          setFailure(
            e instanceof Error ? e.message : "Не удалось открыть библиотеку",
          );
      });
    return () => {
      active = false;
      stopSync();
      stopPreferences();
    };
  }, [user?.id, ready, desired]);
  if (deleting)
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1>Удаление аккаунта начато</h1>
          <p role="status">
            Аккаунт закрыт для работы с библиотекой. Если соединение прервалось,
            завершите удаление повторной попыткой.
          </p>
          {failure && <p role="alert">{failure}</p>}
          <button
            className="button"
            disabled={retrying}
            onClick={() => {
              setFailure("");
              setRetrying(true);
              void (async () => {
                const response = await supabase!.functions.invoke(
                  "delete-account",
                  { body: {} },
                );
                if (response.error || !response.data?.ok)
                  throw new Error("Deletion incomplete");
                const database = currentDatabase();
                await signOut();
                await database.delete();
                clearDraftJournals(database.owner);
              })()
                .catch(() =>
                  setFailure(
                    "Не удалось завершить удаление. Проверьте соединение и повторите.",
                  ),
                )
                .finally(() => setRetrying(false));
            }}
          >
            {retrying ? "Завершаем удаление…" : "Завершить удаление"}
          </button>
          <button
            className="button secondary"
            onClick={() =>
              void signOut().catch(() =>
                setFailure(
                  "Не удалось выйти. Проверьте соединение и повторите.",
                ),
              )
            }
          >
            Выйти
          </button>
        </section>
      </main>
    );
  if (failure)
    return (
      <main className="auth-page panel">
        <h1>Не удалось открыть библиотеку</h1>
        <p role="alert">{failure}</p>
        <button onClick={() => window.location.reload()}>Повторить</button>
      </main>
    );
  if (!ready || workspace !== desired)
    return (
      <main className="auth-page" role="status">
        Открываем вашу библиотеку…
      </main>
    );
  return (
    <div key={desired}>
      {error && <p role="alert">{error}</p>}
      {children}
    </div>
  );
}
