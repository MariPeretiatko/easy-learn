import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "../db/database";
import { newWord } from "./wordModel";
import { clearData } from "./repositories";
import { importLibrary, type LibraryBundle } from "./libraryImport";
import german from "../data/deutsch-a1-b1.json";

beforeEach(clearData);

it("imports every supplied card into the original folder, modules and decks", async () => {
  const known = newWord({
    term: "Hallo",
    translation: "привет",
    reviewCount: 7,
    correctCount: 6,
    notes: "Моя заметка",
  });
  await db.words.add(known);
  const result = await importLibrary(german as LibraryBundle);
  expect(result).toEqual({ addedWords: 4874, decks: 199 });
  expect(await db.words.count()).toBe(4875);
  expect(await db.decks.count()).toBe(199);
  const collections = await db.collections.toArray();
  expect(
    collections
      .filter((item) => item.kind === "folder")
      .map((item) => [item.title, item.deckIds.length]),
  ).toEqual([["Немецкий", 199]]);
  expect(
    collections
      .filter((item) => item.kind === "course")
      .map((item) => [item.title, item.deckIds.length]),
  ).toEqual(
    expect.arrayContaining([
      ["A1 — Основы", 63],
      ["A2 — Повседневная жизнь", 63],
      ["B1 — Самостоятельное общение", 73],
    ]),
  );
  expect(await db.words.get(known.id)).toEqual(known);
  const deck = await db.decks.get(german.folders[0].modules[0].decks[0].id);
  expect(deck?.wordIds).toContain(known.id);
  const ids = new Set((await db.words.toArray()).map((word) => word.id));
  expect(
    (await db.decks.toArray()).every((deck) =>
      deck.wordIds.every((id) => ids.has(id)),
    ),
  ).toBe(true);
  await db.decks.update(deck!.id, { title: "Моё название" });
  await db.words.update(known.id, { translation: "Мой перевод" });
  await importLibrary(german as LibraryBundle);
  expect(await db.words.count()).toBe(4875);
  expect(await db.decks.count()).toBe(199);
  expect(await db.collections.count()).toBe(4);
  expect((await db.decks.get(deck!.id))?.title).toBe("Моё название");
  expect((await db.words.get(known.id))?.translation).toBe("Мой перевод");
});

it("rolls the whole import back if any card is invalid", async () => {
  const invalid = structuredClone(german) as LibraryBundle;
  invalid.folders[0].modules[1].decks[0].cards[0].translation = "";
  await expect(importLibrary(invalid)).rejects.toThrow("перевод");
  expect(await db.words.count()).toBe(0);
  expect(await db.decks.count()).toBe(0);
  expect(await db.collections.count()).toBe(0);
});
