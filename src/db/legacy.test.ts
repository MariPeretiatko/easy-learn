import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { LearningDatabase } from "./database";
import { newWord } from "../services/wordModel";
it("keeps the guest schema compatible with an already open v2 application", async () => {
  const legacy = new Dexie("easy-learn");
  legacy.version(2).stores({
    words: "id, term, language, status, nextReviewAt, *tags",
    decks: "id, language, updatedAt",
    texts: "id, language, updatedAt",
    videos: "id, language, createdAt",
    reviews: "id, wordId, timestamp",
    statistics: "date",
    recent: "key, timestamp",
    drafts: "id, updatedAt, sourceDeckId",
    collections: "id, kind, updatedAt",
    solutions: "id, updatedAt",
    testResults: "id, deckId, timestamp",
  });
  await legacy.open();
  let versionChanged = false;
  legacy.on("versionchange", () => {
    versionChanged = true;
  });
  const current = new LearningDatabase();
  const account = new LearningDatabase(`test-${crypto.randomUUID()}`);
  try {
    await legacy.table("words").put(newWord({ id: "legacy", term: "Legacy" }));
    await current.open();
    await account.open();
    expect(current.verno).toBe(2);
    expect(current.tables).toHaveLength(11);
    expect(account.verno).toBe(4);
    expect(versionChanged).toBe(false);
    expect((await current.words.get("legacy"))?.term).toBe("Legacy");
    await legacy
      .table("words")
      .update("legacy", { notes: "old tab still writes" });
    expect((await current.words.get("legacy"))?.notes).toBe(
      "old tab still writes",
    );
    expect(await account.words.get("legacy")).toBeUndefined();
  } finally {
    legacy.close();
    await current.delete();
    await account.delete();
  }
});
