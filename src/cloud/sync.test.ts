import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LearningDatabase } from "../db/database";
import { newWord } from "../services/wordModel";
import { synchronize } from "./sync";
import type { PendingOperation, RemoteRecord } from "./types";
let database: LearningDatabase;
beforeEach(async () => {
  database = new LearningDatabase(`test-${crypto.randomUUID()}`);
  await database.open();
});
afterEach(async () => {
  await database.delete();
});
it("commits a complete multi-table operation with its outbox and rolls back both on failure", async () => {
  const word = newWord({ term: "Haus", translation: "дом" });
  await database.transaction("rw", database.words, database.decks, async () => {
    await database.words.add(word);
    await database.decks.add({
      id: "deck",
      title: "Deck",
      description: "",
      language: "de",
      tags: [],
      wordIds: [word.id],
      createdAt: 1,
      updatedAt: 1,
      favorite: false,
    });
  });
  const ops = await database.outbox.toArray();
  expect(ops).toHaveLength(1);
  expect(ops[0].changes.map((c) => c.table)).toEqual(["words", "decks"]);
  await expect(
    database.transaction("rw", database.words, async () => {
      await database.words.add(newWord({ id: "rollback" }));
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect(await database.words.get("rollback")).toBeUndefined();
  expect(await database.outbox.count()).toBe(1);
});
it("tracks range deletes, ignores local-only imports, and preserves the original before-image", async () => {
  await database.localOnly(async () => {
    await database.words.add(newWord({ id: "one" }));
    await database.words.add(newWord({ id: "two" }));
  });
  expect(await database.outbox.count()).toBe(0);
  await database.transaction("rw", database.words, async () => {
    await database.words.update("one", { notes: "first" });
    await database.words.update("one", { notes: "second" });
  });
  const op = (await database.outbox.toArray())[0];
  expect(op.changes).toHaveLength(1);
  expect(op.changes[0].before?.notes).toBe("");
  expect(op.changes[0].value?.notes).toBe("second");
  await database.words.clear();
  expect(
    (await database.outbox.toArray())
      .flatMap((op) => op.changes)
      .filter((c) => c.value === null),
  ).toHaveLength(2);
});
it("retries the exact operation after a lost acknowledgement and applies server merged fields", async () => {
  await database.words.add(
    newWord({ id: "one", term: "Haus", translation: "дом" }),
  );
  const seen: string[] = [];
  let lost = true;
  const record: RemoteRecord = {
    kind: "words",
    record_id: "one",
    revision: 1,
    deleted: false,
    data: { ...(await database.words.get("one"))!, notes: "server merged" },
  };
  const remote = {
    pull: async () => [] as RemoteRecord[],
    push: async (op: PendingOperation) => {
      seen.push(op.id);
      if (lost) {
        lost = false;
        throw new Error("network");
      }
      return { ok: true, records: [record] };
    },
  };
  await expect(synchronize(database, remote)).rejects.toThrow("network");
  expect(await database.outbox.count()).toBe(1);
  await synchronize(database, remote);
  expect(seen[0]).toBe(seen[1]);
  expect(await database.outbox.count()).toBe(0);
  expect((await database.words.get("one"))?.notes).toBe("server merged");
});
it("keeps the local transaction and remote copy on conflict", async () => {
  await database.words.add(newWord({ id: "one", term: "Haus" }));
  const record: RemoteRecord = {
    kind: "words",
    record_id: "one",
    revision: 2,
    deleted: false,
    data: { ...(await database.words.get("one"))!, term: "Baum" },
  };
  await synchronize(database, {
    pull: async (cursor) => (cursor ? [] : [record]),
    push: async () => ({ ok: false, conflicts: [record] }),
  });
  expect((await database.words.get("one"))?.term).toBe("Haus");
  expect(await database.conflicts.count()).toBe(1);
  expect(await database.outbox.count()).toBe(1);
});
it("does not apply a late response after switching accounts", async () => {
  let active = true;
  await synchronize(
    database,
    {
      pull: async () => {
        active = false;
        return [
          {
            kind: "words",
            record_id: "foreign",
            revision: 1,
            deleted: false,
            data: newWord({ id: "foreign" }) as unknown as Record<
              string,
              unknown
            >,
          },
        ];
      },
      push: async () => ({ ok: true }),
    },
    () => active,
  );
  expect(await database.words.get("foreign")).toBeUndefined();
});
it("keeps accounts isolated even with matching record IDs", async () => {
  const other = new LearningDatabase(`test-${crypto.randomUUID()}`);
  try {
    await database.words.add(newWord({ id: "same", term: "private" }));
    expect(await other.words.get("same")).toBeUndefined();
    expect(await other.outbox.count()).toBe(0);
  } finally {
    await other.delete();
  }
});

it("preserves commit order when several operations share the same clock time", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1);
  try {
    await database.words.add(newWord({ id: "ordered", term: "first" }));
    await database.words.update("ordered", { term: "second" });
    await database.words.update("ordered", { term: "third" });
    const queue = await database.outbox.orderBy("order").toArray();
    expect(queue.map((op) => op.order)).toEqual([1, 2, 3]);
    expect(queue.map((op) => op.changes[0].value?.term)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(queue.every((op) => op.createdAt === 1)).toBe(true);
  } finally {
    clock.mockRestore();
  }
});
