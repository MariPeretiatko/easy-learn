import { flushPendingWrites } from "../services/pendingWrites";
import { useEffect, useState, type ReactNode } from "react";
import { currentDatabase, selectDatabase } from "../db/database";
import { importPreparedGermanLibrary } from "../services/libraryImport";
import { observeAuth, useAccount } from "./auth";
import { observePreferences, selectPreferences } from "./preferences";
import { startSync, useSync } from "./sync";
import { clearImageRequests } from "./images";
import { useUI } from "../store/useUI";
let transition = Promise.resolve();
export function CloudRoot({ children }: { children: ReactNode }) {
  const { user, ready, generation, error } = useAccount();
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const desired = `${user?.id ?? "guest"}:${generation}`;
  useEffect(observeAuth, []);
  useEffect(() => {
    if (!ready) return;
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
        clearImageRequests();
        useUI.setState({ wordDraft: null, toasts: [] });
        await selectDatabase(user?.id ?? null);
        await selectPreferences(user?.id ?? null);
        const database = currentDatabase();
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
