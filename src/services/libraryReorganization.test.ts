import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "../db/database";
import { newWord } from "./wordModel";
import { clearData, remember } from "./repositories";
import { importLibrary, type LibraryBundle } from "./libraryImport";
import { reorganizeGermanLibrary } from "./libraryReorganization";
import { collectionDeckIds, deleteCollection } from "./collections";
import { createBackup, parseBackup } from "./backup";
import original from "../data/deutsch-a1-b1.json";
import organized from "../data/deutsch-organized.json";

beforeEach(clearData);

async function assertStructure() {
  const decks = await db.decks.toArray();
  const collections = await db.collections.toArray();
  expect(
    decks.filter((deck) => deck.id.startsWith("deutsch-v2-")),
  ).toHaveLength(153);
  expect(
    decks
      .filter((deck) => deck.id.startsWith("deutsch-v2-"))
      .every((deck) => deck.wordIds.length >= 10 && deck.wordIds.length <= 40),
  ).toBe(true);
  expect(
    collections
      .filter((item) => item.kind === "folder")
      .map((folder) => [
        folder.title,
        collectionDeckIds(folder, collections).length,
      ]),
  ).toEqual(
    expect.arrayContaining([
      ["A1", 50],
      ["A2", 40],
      ["B1", 63],
    ]),
  );
  const modules = collections.filter((item) => item.kind === "course");
  expect(modules).toHaveLength(32);
  expect(
    modules.every(
      (module) =>
        module.deckIds.length >= 2 &&
        collections.some(
          (folder) => folder.id === module.folderId && folder.kind === "folder",
        ),
    ),
  ).toBe(true);
  expect(new Set(decks.flatMap((deck) => deck.wordIds)).size).toBe(4875);
  const backup = await createBackup();
  expect(parseBackup(JSON.stringify(backup)).collections).toEqual(
    backup.collections,
  );
}

it("creates level folders, thematic modules and balanced decks without losing or duplicating cards", async () => {
  await importLibrary(organized as LibraryBundle);
  expect(await db.words.count()).toBe(4875);
  await assertStructure();
});

it("migrates word IDs and progress while preserving unrelated decks and collection references", async () => {
  await importLibrary(original as LibraryBundle);
  const oldDeck = (await db.decks.get(
    original.folders[0].modules[0].decks[0].id,
  ))!;
  await db.words.update(oldDeck.wordIds[0], {
    term: "Mein Hallo",
    translation: "Мой перевод",
    reviewCount: 9,
    correctCount: 7,
    notes: "Моя заметка",
    example: "Hallo!",
    status: "review",
    nextReviewAt: 12345,
  });
  await db.reviews.put({
    id: "review",
    wordId: oldDeck.wordIds[0],
    result: "good",
    timestamp: 1,
    responseTime: 10,
  });
  const before = await db.words.toArray();
  await db.decks.update(oldDeck.id, { favorite: true, lastStudiedAt: 100 });
  await db.collections.put({
    id: "personal-folder",
    title: "Моя папка",
    kind: "folder",
    description: "",
    deckIds: [oldDeck.id],
    createdAt: 1,
    updatedAt: 1,
  });
  await remember("decks", oldDeck.id, oldDeck.title);
  const custom = newWord({
    language: "en",
    term: "hello",
    translation: "привет",
  });
  await db.words.add(custom);
  await db.decks.put({
    id: "personal-deck",
    title: "Мой английский",
    language: "en",
    description: "",
    tags: [],
    wordIds: [custom.id],
    createdAt: 1,
    updatedAt: 1,
    favorite: false,
  });
  await reorganizeGermanLibrary(organized as LibraryBundle);
  expect(await db.words.bulkGet(before.map((word) => word.id))).toEqual(before);
  expect(await db.reviews.get("review")).toMatchObject({
    wordId: oldDeck.wordIds[0],
  });
  expect((await db.decks.get("personal-deck"))?.wordIds).toEqual([custom.id]);
  const decks = await db.decks.toArray();
  expect(new Set(decks.flatMap((deck) => deck.wordIds))).toEqual(
    new Set([...before.map((word) => word.id), custom.id]),
  );
  const folder = (await db.collections.get("personal-folder"))!;
  expect(folder.deckIds.length).toBeGreaterThan(0);
  expect(
    folder.deckIds.every((id) => decks.some((deck) => deck.id === id)),
  ).toBe(true);
  expect(
    (await db.recent.toArray()).every((recent) =>
      decks.some((deck) => deck.id === recent.id),
    ),
  ).toBe(true);
  expect(
    decks.some((deck) => deck.favorite && deck.lastStudiedAt === 100),
  ).toBe(true);
  expect(await db.decks.get(oldDeck.id)).toBeUndefined();
  const after = await db.decks.toArray();
  await reorganizeGermanLibrary(organized as LibraryBundle);
  expect(await db.decks.toArray()).toEqual(after);
});

it("rolls back a failed migration and leaves the original library usable", async () => {
  await importLibrary(original as LibraryBundle);
  const invalid = structuredClone(organized) as LibraryBundle;
  delete invalid.folders[0].modules[1].decks[0].cards[0].sourceDeckId;
  await expect(reorganizeGermanLibrary(invalid)).rejects.toThrow("источник");
  expect(await db.decks.count()).toBe(199);
  expect(await db.collections.count()).toBe(4);
  expect(await db.words.count()).toBe(4875);
});

it("detaches modules when deleting their folder so exported backups remain valid", async () => {
  await importLibrary(organized as LibraryBundle);
  await deleteCollection(organized.folders[0].id);
  expect(
    (await db.collections.toArray()).some(
      (item) => item.folderId === organized.folders[0].id,
    ),
  ).toBe(false);
  const backup = await createBackup();
  expect(() => parseBackup(JSON.stringify(backup))).not.toThrow();
});

it("does not resurrect removed vocabulary during reorganization", async () => {
  await importLibrary(original as LibraryBundle);
  const source = (await db.decks.get(
    original.folders[0].modules[0].decks[0].id,
  ))!;
  const removed = source.wordIds[0];
  await db.words.delete(removed);
  await db.decks.update(source.id, {
    wordIds: source.wordIds.filter((id) => id !== removed),
  });
  await reorganizeGermanLibrary(organized as LibraryBundle);
  expect(await db.words.count()).toBe(4874);
  expect(
    (await db.decks.toArray()).some((deck) => deck.wordIds.includes(removed)),
  ).toBe(false);
  expect(
    new Set((await db.decks.toArray()).flatMap((deck) => deck.wordIds)).size,
  ).toBe(4874);
});
