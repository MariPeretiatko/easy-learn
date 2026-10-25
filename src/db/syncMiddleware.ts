import type { DBCore, DBCoreTransaction } from "dexie";
import {
  dataTables,
  equal,
  type Change,
  type PendingOperation,
  type RecordValue,
} from "../cloud/types";
interface TrackedTransaction extends DBCoreTransaction {
  skipCloud?: boolean;
  resetProgress?: boolean;
  operationReady?: Promise<PendingOperation>;
  reviewEvent?: boolean;
}
export function markLocalOnly(transaction: IDBTransaction) {
  (transaction as unknown as TrackedTransaction).skipCloud = true;
}
export function markRestore(transaction: IDBTransaction) {
  (transaction as unknown as TrackedTransaction).resetProgress = true;
}
export function markReview(transaction: IDBTransaction) {
  (transaction as unknown as TrackedTransaction).reviewEvent = true;
}
export function syncMiddleware(owner: string | null) {
  return {
    stack: "dbcore" as const,
    name: "cloud-outbox",
    level: 0,
    create(down: DBCore): DBCore {
      return {
        ...down,
        transaction(stores, mode, options) {
          const tracked =
            owner &&
            mode === "readwrite" &&
            stores.some((s) => (dataTables as readonly string[]).includes(s));
          return down.transaction(
            tracked ? [...new Set([...stores, "outbox", "syncMeta"])] : stores,
            mode,
            options,
          );
        },
        table(name) {
          const table = down.table(name);
          if (!owner || !(dataTables as readonly string[]).includes(name))
            return table;
          return {
            ...table,
            async mutate(req) {
              const trans = req.trans as TrackedTransaction;
              if (
                trans.skipCloud ||
                name === "statistics" ||
                (trans.reviewEvent &&
                  ["words", "statistics", "decks"].includes(name))
              )
                return table.mutate(req);
              const keys =
                req.type === "deleteRange"
                  ? (
                      await table.query({
                        trans,
                        values: false,
                        query: {
                          index: table.schema.primaryKey,
                          range: req.range,
                        },
                      })
                    ).result
                  : req.type === "delete"
                    ? req.keys
                    : req.values.map((v: RecordValue) =>
                        table.schema.primaryKey.extractKey!(v),
                      );
              const old = await table.getMany({ trans, keys });
              const result = await table.mutate(req);
              const changes: Change[] = [];
              for (let i = 0; i < keys.length; i++) {
                if (result.failures[i]) continue;
                const value =
                  req.type === "add" || req.type === "put"
                    ? req.values[i]
                    : null;
                if (equal(old[i] ?? null, value)) continue;
                changes.push({
                  ...(name === "words" && trans.resetProgress
                    ? { resetProgress: true }
                    : {}),
                  table: name as Change["table"],
                  key: String(keys[i]),
                  before: old[i] ?? null,
                  value,
                });
              }
              if (changes.length) {
                if (!trans.operationReady)
                  trans.operationReady = (async () => {
                    const meta = await down
                      .table("syncMeta")
                      .get({ trans, key: "outboxSequence" });
                    const order = Number(meta?.value ?? 0) + 1;
                    const result = await down.table("syncMeta").mutate({
                      trans,
                      type: "put",
                      values: [{ key: "outboxSequence", value: order }],
                    });
                    if (result.numFailures)
                      throw new Error("Не удалось сохранить порядок операций");
                    return {
                      id: crypto.randomUUID(),
                      order,
                      createdAt: Date.now(),
                      changes: [],
                    };
                  })();
                const op = await trans.operationReady;
                for (const change of changes) {
                  if (change.table === "words") {
                    const marked = await down
                      .table("syncMeta")
                      .mutate({
                        trans,
                        type: "put",
                        values: [
                          { key: `personal:words:${change.key}`, value: true },
                        ],
                      });
                    if (marked.numFailures)
                      throw new Error(
                        "Не удалось сохранить владельца изменения",
                      );
                  }
                  const prior = op.changes.find(
                    (c) => c.table === change.table && c.key === change.key,
                  );
                  if (prior) prior.value = change.value;
                  else op.changes.push(change);
                }
                const queued = await down
                  .table("outbox")
                  .mutate({ trans, type: "put", values: [op] });
                if (queued.numFailures)
                  throw new Error("Не удалось сохранить очередь синхронизации");
              }
              return result;
            },
          };
        },
      };
    },
  };
}
