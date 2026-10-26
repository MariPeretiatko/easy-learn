import { clearDraftJournals } from "../../services/draftRecovery";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAccount, signOut } from "../../cloud/auth";
import { supabase, cloudConfigurationError } from "../../cloud/client";
import { currentDatabase } from "../../db/database";
import { guestBackup, importGuestLibrary } from "../../cloud/migration";
import { createBackup, type Backup } from "../../services/backup";
import { download } from "../../services/csv";
import { useSettings } from "../../store/useSettings";
import { withoutCardImages } from "../../cloud/images";
import { useUI } from "../../store/useUI";
import { dataTables } from "../../cloud/types";
import { syncNow, useSync } from "../../cloud/sync";
import { Confirm } from "../../components/UI";
import type { PendingOperation, RemoteRecord } from "../../cloud/types";
export function AccountPanel() {
  const user = useAccount((s) => s.user);
  const database = currentDatabase();
  const conflicts = useLiveQuery(
    () =>
      database.owner ? database.conflicts.orderBy("createdAt").toArray() : [],
    [database.name],
  );
  const failures = useLiveQuery(async () => {
    if (!database.owner) return [];
    const items = await database.syncMeta
      .where("key")
      .startsWith("failure:")
      .toArray();
    return Promise.all(
      items.map(async (item) => ({
        key: item.key,
        detail: item.value as {
          operationId: string;
          code: string;
          message: string;
        },
        operation: await database.outbox.get(item.key.slice(8)),
      })),
    );
  }, [database.name]);
  const queued = useLiveQuery(
    () => (database.owner ? database.outbox.count() : 0),
    [database.name],
  );
  const settings = useSettings((s) => s.settings);
  const [name, setName] = useState(
    settings.profileName ?? user?.user_metadata.display_name ?? "",
  );
  const [avatar, setAvatar] = useState(settings.profileAvatar ?? "🧑‍🎓");
  const [backup, setBackup] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setName(settings.profileName ?? user?.user_metadata.display_name ?? "");
      setAvatar(settings.profileAvatar ?? "🧑‍🎓");
    }
  }, [
    settings.profileName,
    settings.profileAvatar,
    user?.user_metadata.display_name,
    dirty,
  ]);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resolve(
    operation: PendingOperation,
    choice: "local" | "remote",
  ) {
    if (!supabase || !user) return;
    // Refresh every touched record: the conflict may have been displayed for a while.
    const rows: RemoteRecord[] = [];
    for (const change of operation.changes) {
      const { data, error } = await supabase
        .from("sync_records")
        .select("kind,record_id,data,revision,deleted")
        .eq("owner_id", user.id)
        .eq("kind", change.table)
        .eq("record_id", change.key)
        .maybeSingle();
      if (error) throw error;
      if (data) rows.push(data as RemoteRecord);
    }
    for (const row of rows) row.data = withoutCardImages(row.data);
    if (
      currentDatabase() !== database ||
      useAccount.getState().user?.id !== user.id
    )
      throw new Error("Аккаунт изменился. Откройте настройки заново.");
    await database.localOnly(async () => {
      await database.outbox.delete(operation.id);
      await database.conflicts.delete(operation.id);
      if (choice === "local") {
        const rebased = operation.changes.map((c) => {
          const remote = rows.find(
            (r) => r.kind === c.table && r.record_id === c.key,
          );
          return {
            ...c,
            before: remote?.data ?? null,
            restore: !!remote?.deleted,
          };
        });
        await database.outbox.put({
          ...operation,
          id: crypto.randomUUID(),
          changes: rebased,
        });
      } else {
        // Preserve the full local transaction as a downloadable copy before replacing it.
        download(
          "easy-learn-conflict-local.json",
          JSON.stringify(operation, null, 2),
        );
        for (const row of rows)
          await database.syncMeta.put({
            key: `deferred:${row.kind}:${row.record_id}`,
            value: row,
          });
        for (const change of operation.changes) {
          const row = rows.find(
            (r) => r.kind === change.table && r.record_id === change.key,
          );
          const value = row ? (row.deleted ? null : row.data) : change.before;
          if (value) await database.table(change.table).put(value);
          else await database.table(change.table).delete(change.key);
          if (row?.deleted)
            await database.syncMeta.put({
              key: `deleted:${row.kind}:${row.record_id}`,
              value: true,
            });
        }
        // A second local edit of the same record is not silently discarded;
        // it stays queued and can produce its own explicit conflict.
      }
    });
    await syncNow();
  }
  return (
    <section className="panel account-panel">
      <h2>Аккаунт</h2>
      {!user ? (
        <>
          <p>
            {cloudConfigurationError ||
              "Войдите, чтобы сохранять библиотеку и прогресс между устройствами."}
          </p>
          <Link className="button" to="/login">
            Войти
          </Link>
          <Link to="/register">Регистрация</Link>
        </>
      ) : (
        <>
          <p>{user.email}</p>
          <p className="hint">
            Ожидают отправки: {queued ?? 0}. Локальная копия сохраняется при
            выходе, но доступна в приложении только после входа в этот аккаунт.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                const { error } = await supabase!
                  .from("profiles")
                  .update({
                    display_name: name.trim(),
                    avatar,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", user.id);
                if (error) throw error;
                if (currentDatabase() !== database) return;
                useSettings
                  .getState()
                  .update({ profileName: name.trim(), profileAvatar: avatar });
                setDirty(false);
                await syncNow();
              });
            }}
          >
            <label>
              Имя
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setDirty(true);
                  setName(e.target.value);
                }}
              />
            </label>
            <label>
              Аватар
              <select
                value={avatar}
                onChange={(e) => {
                  setDirty(true);
                  setAvatar(e.target.value);
                }}
              >
                {["🧑‍🎓", "👩‍🎓", "👨‍🎓", "🦊", "🐱", "🌻"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button className="button" disabled={busy}>
              Сохранить профиль
            </button>
          </form>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void perform(async () => setBackup(await guestBackup()))
            }
          >
            Перенести библиотеку с этого устройства
          </button>
          {backup && (
            <div className="notice">
              <p>
                Найдено: {backup.words.length} карточек, {backup.decks.length}{" "}
                колод. Исходная локальная библиотека останется на устройстве.
                При совпадениях личные материалы сохранятся отдельными копиями.
              </p>
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    "easy-learn-before-import.json",
                    JSON.stringify(backup),
                  )
                }
              >
                Скачать резервную копию
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await syncNow();
                    if (
                      currentDatabase() !== database ||
                      useAccount.getState().user?.id !== user.id
                    )
                      throw new Error(
                        "Аккаунт изменился. Повторите перенос в нужном аккаунте.",
                      );
                    if (!(await database.syncMeta.get("guestImport"))?.value)
                      await importGuestLibrary(backup);
                    await syncNow();
                    if (await database.outbox.count())
                      throw new Error(
                        "Библиотека сохранена на устройстве. Отправка в облако продолжится после восстановления соединения; повторный перенос не нужен.",
                      );
                    setBackup(null);
                  })
                }
              >
                Перенести в этот аккаунт
              </button>
              <button disabled={busy} onClick={() => setBackup(null)}>
                Отмена
              </button>
            </div>
          )}
          {failures
            ?.filter((failure) => failure.operation)
            .map((failure) => (
              <article className="notice" key={failure.key}>
                <h3>Операция требует внимания</h3>
                <p role="alert">
                  {failure.detail.message} (код {failure.detail.code})
                </p>
                <p className="hint">
                  Операция {failure.detail.operationId}. Связанные изменения
                  остаются на устройстве; независимые отправляются дальше.
                </p>
                <button
                  onClick={() =>
                    download(
                      "easy-learn-pending-operation.json",
                      JSON.stringify(failure.operation, null, 2),
                    )
                  }
                >
                  Скачать операцию
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await database.syncMeta.delete(failure.key);
                      await syncNow();
                    })
                  }
                >
                  Повторить отправку
                </button>
              </article>
            ))}
          {conflicts?.map((conflict) => (
            <article key={conflict.id} className="notice">
              <h3>Изменения с двух устройств</h3>
              <p>
                Выбор применяется ко всей операции, чтобы сохранить целостность
                колоды или теста. Локальную версию можно скачать перед выбором.
              </p>
              <details>
                <summary>Версия на этом устройстве</summary>
                <pre className="conflict-copy">
                  {JSON.stringify(
                    conflict.operation.changes.map((c) => ({
                      table: c.table,
                      key: c.key,
                      value: c.value,
                    })),
                    null,
                    2,
                  )}
                </pre>
              </details>
              <details>
                <summary>Облачная версия на момент конфликта</summary>
                <pre className="conflict-copy">
                  {JSON.stringify(conflict.remote, null, 2)}
                </pre>
              </details>
              <button
                onClick={() =>
                  download(
                    "easy-learn-conflict.json",
                    JSON.stringify(conflict, null, 2),
                  )
                }
              >
                Скачать обе версии
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(() => resolve(conflict.operation, "local"))
                }
              >
                Сохранить мою версию
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(() => resolve(conflict.operation, "remote"))
                }
              >
                Использовать облачную
              </button>
            </article>
          ))}
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void perform(signOut)}
          >
            Выйти
          </button>
          <button
            className="button secondary"
            disabled={busy || !!queued}
            onClick={() =>
              void perform(async () => {
                await syncNow();
                const session = await supabase!.auth.getSession();
                if (
                  session.data.session?.user.id !== user.id ||
                  currentDatabase() !== database ||
                  (await database.outbox.count())
                )
                  throw new Error("Сначала завершите синхронизацию.");
                const { data, error } = await supabase!.functions.invoke(
                  "cleanup-images",
                  {
                    body: {},
                    headers: {
                      Authorization: `Bearer ${session.data.session.access_token}`,
                    },
                  },
                );
                if (error || !data?.ok)
                  throw new Error(
                    "Не удалось очистить файлы. Проверьте доступность серверной функции.",
                  );
                useUI
                  .getState()
                  .toast(`Удалено неиспользуемых изображений: ${data.removed}`);
              })
            }
          >
            Очистить неиспользуемые изображения
          </button>
          <button
            className="button secondary"
            disabled={busy || !!queued}
            onClick={() => setClearingCache(true)}
          >
            Очистить локальную копию
          </button>
          {clearingCache && (
            <Confirm
              title="Загрузить библиотеку заново из облака?"
              description="Будет удалена только локальная копия этого аккаунта. Облачная библиотека сохранится. Нужен интернет и завершённая синхронизация."
              onClose={() => setClearingCache(false)}
              onConfirm={() =>
                void perform(async () => {
                  await syncNow();
                  const session = await supabase!.auth.getUser();
                  if (
                    session.error ||
                    session.data.user?.id !== user.id ||
                    currentDatabase() !== database ||
                    useSync.getState().state !== "saved"
                  )
                    throw new Error(
                      "Сначала дождитесь успешной синхронизации с облаком.",
                    );
                  await database.localOnly(async () => {
                    if (
                      (await database.outbox.count()) ||
                      (await database.conflicts.count())
                    )
                      throw new Error(
                        "Есть неотправленные изменения. Сначала синхронизируйте их.",
                      );
                    for (const table of dataTables)
                      await database.table(table).clear();
                    await database.syncMeta.clear();
                  });
                  for (const key of [
                    "easy-learn-import-deutsch-a1-a2-b1-ru-v1",
                    "easy-learn-import-deutsch-a1-a2-b1-ru-v2",
                  ])
                    localStorage.removeItem(`${key}:${user.id}`);
                  window.location.replace("/library");
                })
              }
            />
          )}
          <button
            className="button danger"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            Удалить аккаунт
          </button>
          {deleting && (
            <Confirm
              title="Удалить аккаунт и все облачные данные?"
              description="Это действие нельзя отменить. Сначала скачайте резервную копию в разделе «Ваши данные»."
              onClose={() => setDeleting(false)}
              onConfirm={() =>
                void perform(async () => {
                  const session = await supabase!.auth.getSession();
                  if (session.data.session?.user.id !== user.id)
                    throw new Error("Аккаунт изменился. Повторите действие.");
                  const token = session.data.session.access_token;
                  download(
                    "easy-learn-before-account-deletion.json",
                    JSON.stringify(await createBackup(database)),
                  );
                  const { data, error } = await supabase!.functions.invoke(
                    "delete-account",
                    { body: {}, headers: { Authorization: `Bearer ${token}` } },
                  );
                  if (error || !data?.ok) {
                    const pending = await supabase!.rpc(
                      "account_deletion_pending",
                    );
                    if (pending.data) {
                      await database.syncMeta.put({
                        key: "accountDeletionPending",
                        value: true,
                      });
                      window.dispatchEvent(
                        new Event("account-deletion-requested"),
                      );
                    }
                    throw new Error(
                      pending.data
                        ? "Удаление начато и будет продолжено. Аккаунт закрыт для работы."
                        : "Не удалось начать удаление аккаунта. Повторите позже.",
                    );
                  }
                  if (useAccount.getState().user?.id === user.id)
                    await signOut();
                  await database.delete();
                  clearDraftJournals(database.owner);
                  localStorage.removeItem(`easy-learn-settings-${user.id}`);
                })
              }
            />
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
