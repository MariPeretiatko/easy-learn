import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "../db/database";
import { newWord } from "./wordModel";
import {
  clearData,
  DeckRepository,
  WordRepository,
  remember,
} from "./repositories";
import { saveCollection } from "./collections";
import { editSetDraft, publishDraft } from "./sets";
import { recordReview } from "./review";
import { createBackup, restoreBackup } from "./backup";
import type { Language, SetDraft } from "../types";

const draft = (
  id: string,
  pairs: string[][],
  language: Language = "de",
): SetDraft => ({
  id,
  title: id,
  language,
  nativeLanguage: "ru",
  description: "",
  createdAt: 1,
  updatedAt: 1,
  cards: pairs.map(([term, definition], i) => ({
    id: `${id}-${i}`,
    term,
    definition,
  })),
});
beforeEach(clearData);

it("preserves legacy duplicate cards and their history when opening and saving old decks", async () => {
  const old = newWord({ term: "Haus", translation: "дом", reviewCount: 8 });
  const copy = newWord({ term: "Haus", translation: "дом", reviewCount: 3 });
  await db.words.bulkPut([old, copy]);
  await db.decks.put({
    id: "legacy",
    title: "Старая колода",
    description: "",
    language: "de",
    tags: [],
    wordIds: [old.id],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
  });
  const draftId = await editSetDraft("legacy");
  await publishDraft((await db.drafts.get(draftId))!);
  await WordRepository.save({ ...old, notes: "Моя заметка" });
  expect((await db.words.get(old.id))?.reviewCount).toBe(8);
  expect((await db.words.get(old.id))?.notes).toBe("Моя заметка");
  expect((await db.words.get(copy.id))?.reviewCount).toBe(3);
});

it("shares identical meanings between decks, separates languages and meanings, and retains one review history", async () => {
  await publishDraft(
    draft("a", [
      ["Bank", "банк"],
      ["Haus", "дом"],
    ]),
  );
  const original = (await db.decks.get("a"))!;
  await recordReview(
    (await db.words.get(original.wordIds[0]))!,
    "good",
    1000,
    "a",
  );
  await publishDraft(
    draft("b", [
      [" Bank ", "банк"],
      ["Bank", "скамейка"],
    ]),
  );
  await publishDraft(draft("en", [["Bank", "банк"]], "en"));
  const second = (await db.decks.get("b"))!;
  expect(second.wordIds[0]).toBe(original.wordIds[0]);
  expect(await db.words.count()).toBe(4);
  expect((await db.words.get(second.wordIds[0]))?.reviewCount).toBe(1);
  const editId = await editSetDraft("b");
  const edit = (await db.drafts.get(editId))!;
  edit.cards[0].definition = "финансовый банк";
  await publishDraft(edit);
  expect((await db.words.get(original.wordIds[0]))?.translation).toBe(
    "финансовый банк",
  );
  expect((await db.words.get(original.wordIds[0]))?.reviewCount).toBe(1);
});

it("removes membership without deleting words or reviews; dictionary deletion removes all memberships", async () => {
  await publishDraft(
    draft("a", [
      ["Haus", "дом"],
      ["Baum", "дерево"],
    ]),
  );
  const original = (await db.decks.get("a"))!;
  const sharedId = original.wordIds[0];
  await recordReview((await db.words.get(sharedId))!, "easy", 1000, "a");
  const copyId = await DeckRepository.duplicate(original);
  const editId = await editSetDraft(copyId);
  const edit = (await db.drafts.get(editId))!;
  edit.cards = edit.cards.slice(1);
  await publishDraft(edit);
  expect((await db.decks.get("a"))?.wordIds).toContain(sharedId);
  expect((await db.decks.get(copyId))?.wordIds).not.toContain(sharedId);
  await DeckRepository.delete("a");
  expect(await db.words.count()).toBe(2);
  expect(await db.reviews.where("wordId").equals(sharedId).count()).toBe(1);
  const remainingId = edit.cards[0].wordId!;
  await WordRepository.delete([remainingId]);
  expect((await db.decks.get(copyId))?.wordIds).toEqual([]);
  expect(await db.words.get(sharedId)).toBeDefined();
});

it("adds the same dictionary word to multiple decks without removing existing membership", async () => {
  await publishDraft(draft("a", [["Haus", "дом"]]));
  await publishDraft(draft("b", [["Baum", "дерево"]]));
  const wordId = (await db.decks.get("a"))!.wordIds[0];
  await WordRepository.move([wordId], "b");
  expect((await db.decks.get("a"))?.wordIds).toContain(wordId);
  expect((await db.decks.get("b"))?.wordIds).toContain(wordId);
  expect(
    await WordRepository.save(
      newWord({ term: "Haus", translation: "дом" }),
      "b",
    ),
  ).toBe(wordId);
  expect(await db.words.count()).toBe(2);
});

it("keeps module language and shared membership in backups, rejecting mixed-language modules atomically", async () => {
  await publishDraft(draft("de-a", [["Haus", "дом"]]));
  await publishDraft(
    draft("de-b", [
      ["Haus", "дом"],
      ["Baum", "дерево"],
    ]),
  );
  await publishDraft(draft("en", [["house", "дом"]], "en"));
  const module = {
    id: "a1",
    kind: "course" as const,
    title: "A1",
    description: "",
    language: "de" as const,
    deckIds: ["de-a", "de-b"],
    createdAt: 1,
    updatedAt: 1,
  };
  await saveCollection(module);
  await expect(
    saveCollection({ ...module, deckIds: ["de-a", "en"] }),
  ).rejects.toThrow("языке");
  expect((await db.collections.get("a1"))?.deckIds).toEqual(["de-a", "de-b"]);
  await remember("modules", module.id, module.title);
  const backup = await createBackup();
  await clearData();
  await restoreBackup(backup);
  expect((await db.recent.get("modules/a1"))?.title).toBe("A1");
  expect((await db.collections.get("a1"))?.language).toBe("de");
  expect((await db.decks.get("de-a"))?.wordIds[0]).toBe(
    (await db.decks.get("de-b"))?.wordIds[0],
  );
  await DeckRepository.delete("de-a");
  expect((await db.collections.get("a1"))?.deckIds).toEqual(["de-b"]);
});
