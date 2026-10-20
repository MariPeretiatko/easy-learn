import "fake-indexeddb/auto";
import { beforeEach, it, expect } from "vitest";
import { db } from "../db/database";
import {
  clearData,
  newWord,
  WordRepository,
  TextRepository,
} from "./repositories";
import { createBackup, parseBackup, restoreBackup } from "./backup";
beforeEach(async () => {
  await clearData();
});
it("saves a source word and its automatic deck atomically", async () => {
  const word = newWord({
    term: "Kaffee",
    translation: "кофе",
    sourceId: "text-1",
    sourceType: "text",
    sourceTitle: "Im Café",
  });
  await WordRepository.save(word);
  const decks = await db.decks.toArray();
  expect(decks).toHaveLength(1);
  expect(decks[0].wordIds).toEqual([word.id]);
  await expect(
    WordRepository.save(newWord({ term: "kaffee", translation: "кофе" })),
  ).rejects.toThrow("уже есть");
  expect(await db.words.count()).toBe(1);
});
it("rolls back a save when the chosen deck has the wrong language", async () => {
  await db.decks.add({
    id: "en",
    title: "English",
    description: "",
    language: "en",
    tags: [],
    wordIds: [],
    createdAt: 1,
    updatedAt: 1,
    favorite: false,
  });
  await expect(
    WordRepository.save(newWord({ term: "Hund", translation: "собака" }), "en"),
  ).rejects.toThrow();
  expect(await db.words.count()).toBe(0);
  expect(await db.statistics.count()).toBe(0);
});
it("roundtrips every database table and rejects invalid copies before restoring", async () => {
  await WordRepository.save(newWord({ term: "Hund", translation: "собака" }));
  const backup = await createBackup();
  expect(parseBackup(JSON.stringify(backup)).words).toHaveLength(1);
  await clearData();
  await restoreBackup(backup);
  expect(await db.words.count()).toBe(1);
  const corrupt = { ...backup, words: [{ ...backup.words[0], tags: "bad" }] };
  expect(() => parseBackup(JSON.stringify(corrupt))).toThrow();
  expect(await db.words.count()).toBe(1);
});
it("does not regress completed reading progress after scroll events", async () => {
  await db.texts.add({
    id: "text",
    title: "Test",
    content: "Hallo",
    language: "de",
    source: "",
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    readingProgress: 100,
    favorite: false,
  });
  await TextRepository.progress("text", 25);
  expect((await db.texts.get("text"))?.readingProgress).toBe(100);
});
