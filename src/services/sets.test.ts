import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "../db/database";
import { newWord } from "./wordModel";
import { clearData, WordRepository } from "./repositories";
import { saveCollection } from "./collections";
import { editSetDraft, publishDraft } from "./sets";
import { createBackup, parseBackup, restoreBackup } from "./backup";
import type { SetDraft } from "../types";
const draft: SetDraft = {
  id: "draft",
  title: "Deutsch",
  description: "",
  language: "de",
  nativeLanguage: "uk",
  cards: [
    { id: "one", term: "Haus", definition: "будинок" },
    { id: "two", term: "Baum", definition: "дерево" },
  ],
  createdAt: 1,
  updatedAt: 1,
};
beforeEach(clearData);
it("publishes a complete draft atomically and keeps card order and definition language", async () => {
  await db.drafts.put(draft);
  const id = await publishDraft(draft);
  const set = await db.decks.get(id);
  expect(set?.wordIds).toHaveLength(2);
  const words = await db.words.bulkGet(set!.wordIds);
  expect(words.map((w) => w?.term)).toEqual(["Haus", "Baum"]);
  expect(words[0]?.nativeLanguage).toBe("uk");
  expect(await db.drafts.count()).toBe(0);
});
it("keeps a failing draft and rolls back its earlier valid cards", async () => {
  const bad = {
    ...draft,
    cards: [draft.cards[0], { id: "bad", term: "Baum", definition: "" }],
  };
  await db.drafts.put(bad);
  await expect(publishDraft(bad)).rejects.toThrow();
  expect(await db.drafts.get(bad.id)).toEqual(bad);
  expect(await db.words.count()).toBe(0);
  expect(await db.decks.count()).toBe(0);
  expect(await db.statistics.count()).toBe(0);
});
it("resumes one edit draft, preserves scheduling and discards legacy images", async () => {
  const word = newWord({
    term: "Haus",
    translation: "дом",
    reviewCount: 7,
    interval: 12,
    status: "review",
    image: "data:image/png;base64,aA==",
    termImage: "data:image/png;base64,dGVybQ==",
  });
  await WordRepository.save(word);
  await db.decks.put({
    id: "source",
    title: "Source",
    description: "",
    language: "de",
    tags: [],
    wordIds: [word.id],
    createdAt: 1,
    updatedAt: 1,
    favorite: false,
  });
  const id = await editSetDraft("source");
  expect(await editSetDraft("source")).toBe(id);
  const edit = (await db.drafts.get(id))!;
  edit.cards[0].image = undefined;
  edit.cards.push({ id: "second", term: "Baum", definition: "дерево" });
  await publishDraft(edit);
  expect(await db.words.get(word.id)).toMatchObject({
    reviewCount: 7,
    interval: 12,
    status: "review",
  });
  expect((await db.words.get(word.id))?.image).toBeUndefined();
  expect((await db.words.get(word.id))?.termImage).toBeUndefined();
  const backup = await createBackup();
  await clearData();
  await restoreBackup(backup);
  expect((await db.words.get(word.id))?.termImage).toBeUndefined();
});
it("backs up and restores drafts, collections, explanations and test results; accepts old backups", async () => {
  await publishDraft(draft);
  await db.drafts.put({ ...draft, id: "unpublished" });
  await saveCollection({
    id: "folder",
    kind: "folder",
    title: "A1",
    description: "",
    deckIds: [draft.id],
    createdAt: 1,
    updatedAt: 1,
  });
  await db.solutions.put({
    id: "solution",
    title: "Regel",
    question: "Warum?",
    answer: "Darum.",
    createdAt: 1,
    updatedAt: 1,
  });
  await db.testResults.put({
    id: "result",
    title: "Test",
    timestamp: 1,
    deckId: draft.id,
    answers: [{ term: "Haus", expected: "дом", given: "дом", correct: true }],
  });
  const backup = await createBackup();
  await clearData();
  await restoreBackup(backup);
  expect(await db.drafts.count()).toBe(1);
  expect(await db.collections.count()).toBe(1);
  expect(await db.solutions.count()).toBe(1);
  expect(await db.testResults.count()).toBe(1);
  const old = { ...backup };
  for (const key of [
    "drafts",
    "collections",
    "solutions",
    "testResults",
  ] as const)
    delete (old as Partial<typeof backup>)[key];
  expect(parseBackup(JSON.stringify(old)).drafts).toEqual([]);
  const broken = {
    ...backup,
    collections: [{ ...backup.collections[0], deckIds: ["missing"] }],
  };
  expect(() => parseBackup(JSON.stringify(broken))).toThrow("коллекция");
});
it("keeps distinct meanings and shares cards and edits across deck copies", async () => {
  const sameTerm = {
    ...draft,
    cards: [
      { id: "1", term: "Bank", definition: "лавка" },
      { id: "2", term: "Bank", definition: "банк" },
    ],
  };
  const id = await publishDraft(sameTerm);
  const source = (await db.decks.get(id))!;
  const { DeckRepository } = await import("./repositories");
  const copyId = await DeckRepository.duplicate(source);
  const copy = (await db.decks.get(copyId))!;
  expect(copy.wordIds).toEqual(source.wordIds);
  const editId = await editSetDraft(copyId);
  const edit = (await db.drafts.get(editId))!;
  edit.cards[0].definition = "скамейка";
  await publishDraft(edit);
  expect((await db.words.get(source.wordIds[0]))?.translation).toBe("скамейка");
  expect((await db.words.get(copy.wordIds[0]))?.translation).toBe("скамейка");
});

it("preserves accepted answers through publishing, edit drafts and full backups", async () => {
  const value = {
    ...draft,
    cards: [
      {
        ...draft.cards[0],
        acceptedTerms: [" Zuhause ", ""],
        acceptedTranslations: ["оселя", "житло"],
      },
    ],
  };
  const id = await publishDraft(value);
  let word = (await db.words.toArray())[0];
  expect(word.acceptedTerms).toEqual(["Zuhause"]);
  expect(word.acceptedTranslations).toEqual(["оселя", "житло"]);
  const editId = await editSetDraft(id);
  expect((await db.drafts.get(editId))?.cards[0].acceptedTranslations).toEqual([
    "оселя",
    "житло",
  ]);
  const backup = await createBackup();
  await clearData();
  await restoreBackup(backup);
  word = (await db.words.toArray())[0];
  expect(word.acceptedTranslations).toEqual(["оселя", "житло"]);
  const invalid = JSON.parse(JSON.stringify(backup));
  invalid.words[0].acceptedTerms = [true];
  expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
});
