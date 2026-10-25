import type { Json } from "./database.types";
import { create } from "zustand";
import type { CloudClient } from "./client";
import { currentDatabase, type LearningDatabase } from "../db/database";
import { useAccount } from "./auth";
import { supabase } from "./client";
import { dataTables, type PendingOperation, type RemoteRecord } from "./types";
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
  async function pull() {
    while (isActive()) {
      const cursor = Number(
        (await database.syncMeta.get("cursor"))?.value ?? 0,
      );
      const rows = await remote.pull(cursor);
      if (!isActive()) return;
      if (!rows.length) break;
      await database.localOnly(async () => {
        const pending = (await database.outbox.toArray()).flatMap(
          (op) => op.changes,
        );
        for (const row of rows) {
          if (!dataTables.includes(row.kind))
            throw new Error("Неизвестная версия облачных данных");
          // Keep optimistic changes visible until their complete transaction is acknowledged.
          if (
            pending.some((c) => c.table === row.kind && c.key === row.record_id)
          ) {
            await database.syncMeta.put({
              key: `deferred:${row.kind}:${row.record_id}`,
              value: row,
            });
            continue;
          }
          if (row.deleted) {
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
        await rebuildDerived(database);
      });
      if (rows.length < 200) break;
    }
  }
  await pull();
  if (!isActive()) return;
  const pending = await database.outbox.orderBy("order").toArray();
  for (const operation of pending) {
    if (!isActive()) return;
    if (await database.conflicts.get(operation.id)) {
      useSync.setState({
        state: "conflict",
        message:
          "Есть изменения с другого устройства. Выберите версию в настройках.",
      });
      return;
    }
    const result = await remote.push(operation);
    if (!isActive()) return;
    if (!result.ok) {
      await database.conflicts.put({
        id: operation.id,
        operation,
        remote: result.conflicts ?? [],
        createdAt: Date.now(),
      });
      useSync.setState({
        state: "conflict",
        message: "Конфликт изменений. Обе версии сохранены в настройках.",
      });
      return;
    }
    if (
      !Array.isArray(result.records) ||
      result.records.length < operation.changes.length
    )
      throw new Error("Неполное подтверждение облачной операции");
    await database.localOnly(async () => {
      await database.outbox.delete(operation.id);
      for (const row of result.records ?? [])
        await database.syncMeta.put({
          key: `deferred:${row.kind}:${row.record_id}`,
          value: row,
        });
      const remaining = (await database.outbox.toArray()).flatMap(
        (op) => op.changes,
      );
      for (const item of await database.syncMeta.toArray()) {
        if (!item.key.startsWith("deferred:")) continue;
        const row = item.value as RemoteRecord;
        if (
          remaining.some((c) => c.table === row.kind && c.key === row.record_id)
        )
          continue;
        if (row.deleted) {
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
      await rebuildDerived(database);
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
      state: (await database.outbox.count()) ? "local" : "saved",
      message: "",
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
      } catch {
        if (active())
          useSync.setState({
            state: "error",
            message:
              "Не удалось синхронизировать. Изменения сохранены на устройстве; проверьте сеть, сессию и доступность облака.",
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
