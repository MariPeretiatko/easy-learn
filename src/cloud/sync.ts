import type { Json } from "./database.types";
import { create } from "zustand";
import type { CloudClient } from "./client";
import { currentDatabase, type LearningDatabase } from "../db/database";
import { useAccount } from "./auth";
import { supabase } from "./client";
import {
  dataTables,
  type Change,
  type PendingOperation,
  type RemoteRecord,
} from "./types";
import { transformImages, resetUploadChecks } from "./images";
import { rebuildDerived } from "./derived";
import { useSettings } from "../store/useSettings";
import { withDefaultSettings } from "../store/settingsDefaults";
export const useSync = create<{
  state: "local" | "syncing" | "saved" | "error" | "conflict";
  message: string;
}>(() => ({ state: "local", message: "" }));
interface Transport {
  pull(cursor: number): Promise<RemoteRecord[]>;
  push(operation: PendingOperation): Promise<{
    ok: boolean;
    conflicts?: RemoteRecord[];
    records?: RemoteRecord[];
  }>;
}
function transport(client: CloudClient, owner: string): Transport {
  return {
    async pull(cursor) {
      const { data, error } = await client
        .from("sync_records")
        .select("kind,record_id,data,revision,deleted")
        .eq("owner_id", owner)
        .gt("revision", cursor)
        .order("revision")
        .limit(200);
      if (error) throw error;
      return Promise.all(
        (data as RemoteRecord[]).map(async (record) => ({
          ...record,
          data: await transformImages(client, owner, record.data, "download"),
        })),
      );
    },
    async push(operation) {
      resetUploadChecks();
      const changes = await Promise.all(
        operation.changes.map(async (change) => ({
          ...change,
          before: await transformImages(client, owner, change.before, "upload"),
          value: await transformImages(client, owner, change.value, "upload"),
        })),
      );
      let data: unknown;
      if (changes.length > 100) {
        const total = Math.ceil(changes.length / 100);
        for (let part = 0; part < total; part++) {
          const response = await client.rpc("stage_sync_batch", {
            operation_id: operation.id,
            part_no: part,
            total_parts: total,
            changes: changes.slice(
              part * 100,
              (part + 1) * 100,
            ) as unknown as Json,
          });
          if (response.error) throw response.error;
          data = response.data;
          if (!(response.data as { staged?: boolean } | null)?.staged) break;
        }
      } else {
        const response = await client.rpc("apply_sync_batch", {
          operation_id: operation.id,
          changes: changes as unknown as Json,
        });
        if (response.error) throw response.error;
        data = response.data;
      }
      const result = data as {
        ok: boolean;
        conflicts?: RemoteRecord[];
        records?: RemoteRecord[];
      };
      if (result.records)
        result.records = await Promise.all(
          result.records.map(async (r) => ({
            ...r,
            data: await transformImages(client, owner, r.data, "download"),
          })),
        );
      if (result.conflicts)
        result.conflicts = await Promise.all(
          result.conflicts.map(async (r) => ({
            ...r,
            data: await transformImages(client, owner, r.data, "download"),
          })),
        );
      return result;
    },
  };
}
export async function synchronize(
  database: LearningDatabase,
  remote: Transport,
  isActive = () => true,
) {
  async function pendingKeys(keys: string[]) {
    const found = new Set<string>();
    if (keys.length)
      await database.outbox
        .where("recordKeys")
        .anyOf(keys)
        .eachKey((key) => {
          found.add(String(key));
        });
    return found;
  }
  async function* queuedOperations() {
    const ceiling = (await database.outbox.orderBy("order").last())?.order;
    if (ceiling === undefined) return;
    let after = -Infinity;
    while (isActive()) {
      const page = await database.outbox
        .where("order")
        .between(after, ceiling, false, true)
        .limit(50)
        .toArray();
      if (!page.length) return;
      for (const operation of page) {
        after = operation.order;
        yield operation;
      }
    }
  }
  async function pull() {
    while (isActive()) {
      const cursor = Number(
        (await database.syncMeta.get("cursor"))?.value ?? 0,
      );
      const rows = await remote.pull(cursor);
      if (!isActive()) return;
      if (!rows.length) break;
      await database.localOnly(async () => {
        const changed: Change[] = [];
        const pending = await pendingKeys(
          rows.map((row) => `${row.kind}:${row.record_id}`),
        );
        for (const row of rows) {
          if (!dataTables.includes(row.kind))
            throw new Error("Неизвестная версия облачных данных");
          // Keep optimistic changes visible until their complete transaction is acknowledged.
          if (pending.has(`${row.kind}:${row.record_id}`)) {
            await database.syncMeta.put({
              key: `deferred:${row.kind}:${row.record_id}`,
              value: row,
            });
            continue;
          }
          changed.push({
            table: row.kind,
            key: row.record_id,
            before: (await database.table(row.kind).get(row.record_id)) ?? null,
            value: row.deleted ? null : row.data,
          });
          if (row.deleted) {
            if (
              row.kind === "preferences" &&
              row.record_id === "statisticsBaseline"
            )
              await database.syncMeta.delete("statisticsBaseline");
            await database.table(row.kind).delete(row.record_id);
            await database.syncMeta.put({
              key: `deleted:${row.kind}:${row.record_id}`,
              value: true,
            });
          } else {
            await database.table(row.kind).put(row.data);
            if (row.kind === "words")
              await database.syncMeta.put({
                key: `personal:words:${row.record_id}`,
                value: true,
              });
            await database.syncMeta.delete(
              `deleted:${row.kind}:${row.record_id}`,
            );
            if (
              row.kind === "preferences" &&
              row.record_id === "statisticsBaseline"
            )
              await database.syncMeta.put({
                key: "statisticsBaseline",
                value: row.data?.value,
              });
          }
        }
        await database.syncMeta.put({
          key: "cursor",
          value: rows.at(-1)!.revision,
        });
        await rebuildDerived(database, changed);
      });
      if (rows.length < 200) break;
    }
  }
  await pull();
  if (!isActive()) return;
  const blockedKeys = new Set<string>();
  let hasConflict = false,
    hasFailure = false;
  const collectReferences = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if ((key === "id" || key.endsWith("Id")) && typeof item === "string")
        blockedKeys.add(item);
      else if (key.endsWith("Ids") && Array.isArray(item))
        item.forEach((id) => {
          if (typeof id === "string") blockedKeys.add(id);
        });
      else if (item && typeof item === "object") collectReferences(item);
    }
  };
  const block = (operation: PendingOperation) =>
    operation.changes.forEach((change) => {
      blockedKeys.add(change.key);
      collectReferences(change.before);
      collectReferences(change.value);
    });
  const referencesBlocked = (value: unknown): boolean =>
    typeof value === "string"
      ? blockedKeys.has(value)
      : Array.isArray(value)
        ? value.some(referencesBlocked)
        : !!value &&
          typeof value === "object" &&
          Object.values(value).some(referencesBlocked);
  for await (const operation of queuedOperations()) {
    if (
      operation.changes.some(
        (change) =>
          blockedKeys.has(change.key) ||
          referencesBlocked(change.value) ||
          referencesBlocked(change.before),
      )
    ) {
      block(operation);
      continue;
    }
    if (!isActive()) return;
    const failure = (await database.syncMeta.get(`failure:${operation.id}`))
      ?.value as { permanent?: boolean } | undefined;
    if (failure?.permanent) {
      hasFailure = true;
      block(operation);
      continue;
    }
    if (await database.conflicts.get(operation.id)) {
      hasConflict = true;
      block(operation);
      continue;
    }
    let result: Awaited<ReturnType<Transport["push"]>>;
    try {
      result = await remote.push(operation);
    } catch (error) {
      if (!isActive()) return;
      const detail = error as {
        code?: string;
        message?: string;
        status?: number;
        statusCode?: string;
      };
      const code = String(
        detail.code ?? detail.status ?? detail.statusCode ?? "unknown",
      );
      const temporary =
        /cleanup in progress|maintenance|timeout|network|fetch|connection|обслуживан/i.test(
          detail.message ?? "",
        );
      const permanent =
        !temporary &&
        (/^(22|23|P0001|400|413|422)/.test(code) ||
          /Недопустимое изображение|Изображение принадлежит другому аккаунту/i.test(
            detail.message ?? "",
          ));
      await database.syncMeta.put({
        key: `failure:${operation.id}`,
        value: {
          permanent,
          operationId: operation.id,
          code,
          message: detail.message ?? "Ошибка отправки",
          at: Date.now(),
        },
      });
      // Network/session failures affect the whole connection. Data errors affect this operation and its dependants.
      if (!permanent) throw error;
      hasFailure = true;
      block(operation);
      continue;
    }
    if (!isActive()) return;
    if (!result.ok) {
      await database.conflicts.put({
        id: operation.id,
        operation,
        remote: result.conflicts ?? [],
        createdAt: Date.now(),
      });
      hasConflict = true;
      block(operation);
      continue;
    }
    if (
      !Array.isArray(result.records) ||
      result.records.length < operation.changes.length
    )
      throw new Error("Неполное подтверждение облачной операции");
    await database.localOnly(async () => {
      const changed: Change[] = [];
      await database.syncMeta.delete(`failure:${operation.id}`);
      await database.outbox.delete(operation.id);
      for (const row of result.records ?? [])
        await database.syncMeta.put({
          key: `deferred:${row.kind}:${row.record_id}`,
          value: row,
        });
      const deferred = await database.syncMeta
        .where("key")
        .startsWith("deferred:")
        .toArray();
      const remaining = await pendingKeys(
        deferred.map((item) => {
          const row = item.value as RemoteRecord;
          return `${row.kind}:${row.record_id}`;
        }),
      );
      for (const item of deferred) {
        const row = item.value as RemoteRecord;
        if (remaining.has(`${row.kind}:${row.record_id}`)) continue;
        changed.push({
          table: row.kind,
          key: row.record_id,
          before: (await database.table(row.kind).get(row.record_id)) ?? null,
          value: row.deleted ? null : row.data,
        });
        if (row.deleted) {
          if (
            row.kind === "preferences" &&
            row.record_id === "statisticsBaseline"
          )
            await database.syncMeta.delete("statisticsBaseline");
          await database.table(row.kind).delete(row.record_id);
          await database.syncMeta.put({
            key: `deleted:${row.kind}:${row.record_id}`,
            value: true,
          });
        } else {
          await database.table(row.kind).put(row.data);
          if (row.kind === "words")
            await database.syncMeta.put({
              key: `personal:words:${row.record_id}`,
              value: true,
            });
          await database.syncMeta.delete(
            `deleted:${row.kind}:${row.record_id}`,
          );
          if (
            row.kind === "preferences" &&
            row.record_id === "statisticsBaseline"
          )
            await database.syncMeta.put({
              key: "statisticsBaseline",
              value: row.data?.value,
            });
        }
        await database.syncMeta.delete(item.key);
      }
      await rebuildDerived(database, changed);
    });
  }
  await pull();
  if (isActive()) {
    const settings = await database.preferences.get("settings");
    if (settings)
      useSettings.setState({
        settings: withDefaultSettings(
          settings.value as Parameters<typeof withDefaultSettings>[0],
        ),
      });
    useSync.setState({
      state: hasConflict
        ? "conflict"
        : hasFailure
          ? "error"
          : (await database.outbox.count())
            ? "local"
            : "saved",
      message: hasConflict
        ? "Есть конфликт версий. Независимые изменения отправлены; откройте настройки."
        : hasFailure
          ? "Часть операций требует исправления. Подробности и резервная копия доступны в настройках."
          : "",
    });
  }
}
let runner: (() => Promise<void>) | null = null;
export async function syncNow() {
  await runner?.();
}
export function startSync(database: LearningDatabase) {
  if (!supabase || !database.owner) return () => undefined;
  let stopped = false;
  let running: Promise<void> | null = null;
  const client = supabase,
    owner = database.owner;
  const active = () =>
    !stopped &&
    currentDatabase() === database &&
    useAccount.getState().user?.id === owner;
  const run = (): Promise<void> => {
    if (running) return running;
    if (!active() || !navigator.onLine) return Promise.resolve();
    running = (async () => {
      useSync.setState({ state: "syncing", message: "" });
      const action = async () => {
        if (active())
          await synchronize(database, transport(client, owner), active);
      };
      try {
        if (navigator.locks)
          await navigator.locks.request(`easy-learn-sync-${owner}`, action);
        else await action();
      } catch (error) {
        const detail = error as { code?: string; message?: string };
        if (active())
          useSync.setState({
            state: "error",
            message: `Не удалось синхронизировать (${detail.code ?? "network"}). Изменения сохранены на устройстве. ${detail.message ?? "Проверьте подключение."}`,
          });
      } finally {
        running = null;
      }
    })();
    return running;
  };
  runner = run;
  const timer = window.setInterval(() => void run(), 10000);
  window.addEventListener("online", run);
  void run();
  return () => {
    stopped = true;
    clearInterval(timer);
    window.removeEventListener("online", run);
    if (runner === run) runner = null;
  };
}
