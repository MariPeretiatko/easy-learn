import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "../db/database";
import { clearData } from "./repositories";
import { newWord } from "./wordModel";
import { importVocabulary } from "./importVocabulary";
beforeEach(clearData);
it("reuses duplicate cards and attaches them to the selected deck without resetting progress", async () => {
  const existing = newWord({
    term: "Haus",
    translation: "дом",
    reviewCount: 7,
  });
  await db.words.add(existing);
  await db.decks.add({
    id: "deck",
    title: "Deutsch",
    description: "",
    language: "de",
    tags: [],
    wordIds: [],
    createdAt: 1,
    updatedAt: 1,
    favorite: false,
  });
  const result = await importVocabulary(
    [
      { term: "Haus", translation: "дом", example: "", tags: [] },
      { term: "Baum", translation: "дерево", example: "", tags: [] },
      { term: "Baum", translation: "дерево", example: "", tags: [] },
    ],
    "de",
    "ru",
    "deck",
  );
  expect(result).toEqual({ added: 1, skipped: 2 });
  expect(await db.words.count()).toBe(2);
  expect((await db.decks.get("deck"))?.wordIds).toHaveLength(2);
  expect((await db.words.get(existing.id))?.reviewCount).toBe(7);
});
it("does not import partial data if a later row is invalid", async () => {
  await expect(
    importVocabulary(
      [
        { term: "Haus", translation: "дом", example: "", tags: [] },
        { term: "Baum", translation: "", example: "", tags: [] },
      ],
      "de",
      "ru",
    ),
  ).rejects.toThrow();
  expect(await db.words.count()).toBe(0);
  expect(await db.statistics.count()).toBe(0);
});
it("imports a large list using one bulk insert and one membership update", async () => {
  const { vi } = await import("vitest");
  await db.decks.add({
    id: "large",
    title: "Large",
    description: "",
    language: "de",
    tags: [],
    wordIds: [],
    createdAt: 1,
    updatedAt: 1,
    favorite: false,
  });
  const inserts = vi.spyOn(db.words, "bulkAdd"),
    membership = vi.spyOn(db.decks, "update");
  const rows = Array.from({ length: 2000 }, (_, i) => ({
    term: `Word ${i}`,
    translation: `Слово ${i}`,
  }));
  const result = await importVocabulary(rows, "de", "ru", "large");
  expect(result.added).toBe(2000);
  expect(inserts).toHaveBeenCalledTimes(1);
  expect(membership).toHaveBeenCalledTimes(1);
  expect((await db.decks.get("large"))?.wordIds).toHaveLength(2000);
  expect((await db.statistics.toArray())[0].wordsAdded).toBe(2000);
  vi.restoreAllMocks();
});
