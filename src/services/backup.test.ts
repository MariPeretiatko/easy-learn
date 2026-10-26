import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";
import { clearData } from "./repositories";
import { newWord } from "./wordModel";
beforeEach(clearData);
it("roundtrips its own JSON above the previous 20 MB import limit", async () => {
  const backup = await createBackup();
  backup.words = Array.from({ length: 5 }, (_, index) =>
    newWord({
      id: String(index),
      term: `word${index}`,
      translation: `перевод${index}`,
      image: `data:image/png;base64,${"A".repeat(4 * 1024 * 1024)}`,
    }),
  );
  const json = JSON.stringify(backup);
  expect(new Blob([json]).size).toBeGreaterThan(20_000_000);
  expect(parseBackup(json).words).toHaveLength(5);
});
it("rejects oversized media and mixed-language decks before replacing data", async () => {
  const backup = await createBackup();
  backup.words = [
    newWord({
      id: "w",
      term: "Haus",
      translation: "дом",
      image: `data:image/png;base64,${"A".repeat(4 * 1024 * 1024 + 4)}`,
    }),
  ];
  expect(() => parseBackup(JSON.stringify(backup))).toThrow("3 МБ");
  delete backup.words[0].image;
  backup.decks = [
    {
      id: "d",
      title: "English",
      description: "",
      language: "en",
      tags: [],
      wordIds: ["w"],
      createdAt: 1,
      updatedAt: 1,
      favorite: false,
    },
  ];
  expect(() => parseBackup(JSON.stringify(backup))).toThrow("Язык колоды");
});
