import { expect, it } from "vitest";
import { collectionsForLanguage } from "./libraryScope";
import { recentStudyItems } from "./recent";
import type { Collection, Deck, Language } from "../types";
const deck = (id: string, language: Language): Deck => ({
  id,
  language,
  title: id,
  description: "",
  tags: [],
  wordIds: [],
  createdAt: 1,
  updatedAt: 1,
  favorite: false,
});
const group = (id: string, extra: Partial<Collection> = {}): Collection => ({
  id,
  kind: "folder",
  title: id,
  description: "",
  deckIds: [],
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
it("separates legacy folders, empty modules, explicit empty folders and custom subjects", () => {
  const decks = [deck("de", "de"), deck("en", "en")];
  const collections = [
    group("legacy-de"),
    group("de-module", {
      kind: "course",
      folderId: "legacy-de",
      deckIds: ["de"],
    }),
    group("en-folder", { language: "en" }),
    group("empty-en", { kind: "course", folderId: "en-folder" }),
    group("unknown-empty", { kind: "course" }),
    group("topic", { language: "topic-math" as Language }),
  ];
  expect(
    collectionsForLanguage(collections, decks, "en").map((item) => item.id),
  ).toEqual(["en-folder", "empty-en"]);
  expect(
    collectionsForLanguage(collections, decks, "de").map((item) => item.id),
  ).toEqual(["legacy-de", "de-module", "unknown-empty"]);
  expect(
    collectionsForLanguage(collections, decks, "topic-math").map(
      (item) => item.id,
    ),
  ).toEqual(["topic"]);
  expect(collectionsForLanguage(collections, decks, "fr")).toEqual([]);
});
it("scopes mixed legacy folders without mutating or deleting their other memberships", () => {
  const original = group("mixed", { deckIds: ["de", "en"] });
  const scoped = collectionsForLanguage(
    [original],
    [deck("de", "de"), deck("en", "en")],
    "en",
  );
  expect(scoped[0].deckIds).toEqual(["en"]);
  expect(original.deckIds).toEqual(["de", "en"]);
});
it("filters recent materials before limiting the list", () => {
  const decks = [deck("de", "de"), deck("en", "en")];
  const recent = decks.map((item, i) => ({
    key: `decks/${item.id}`,
    kind: "decks" as const,
    id: item.id,
    title: item.title,
    timestamp: i,
  }));
  expect(
    recentStudyItems({ recent, decks, collections: [] }, "en").map(
      (item) => item.id,
    ),
  ).toEqual(["en"]);
});
