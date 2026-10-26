import { beforeEach, expect, it, vi } from "vitest";
import {
  clearDraftJournal,
  clearDraftJournals,
  journalDraft,
  recoverDraft,
} from "./draftRecovery";
import type { SetDraft } from "../types";
beforeEach(() => localStorage.clear());
const draft: SetDraft = {
  id: "journal",
  title: "Последний ввод",
  description: "",
  language: "de",
  nativeLanguage: "ru",
  createdAt: 1,
  updatedAt: 2,
  cards: [
    {
      id: "c",
      term: "Haus",
      definition: "дом",
      image: "data:image/png;base64,old",
    },
  ],
};
it("recovers text before an IndexedDB write completes, without leaking across accounts", () => {
  journalDraft("one", draft);
  expect(recoverDraft("one", draft.id)?.title).toBe(draft.title);
  expect(recoverDraft("two", draft.id)).toBeUndefined();
  expect(recoverDraft(null, draft.id)).toBeUndefined();
  clearDraftJournal("one", draft.id);
});
it("discards old media and ignores journals older than IndexedDB", () => {
  journalDraft("one", draft);
  expect(
    recoverDraft("one", draft.id, { ...draft, title: "old", updatedAt: 1 })
      ?.cards[0].image,
  ).toBeUndefined();
  expect(
    recoverDraft("one", draft.id, { ...draft, title: "newer", updatedAt: 3 })
      ?.title,
  ).toBe("newer");
  clearDraftJournal("one", draft.id);
  expect(recoverDraft("one", draft.id)).toBeUndefined();
});

it("journals only the edited card in a large draft and recovers order and removals", () => {
  const stored = {
    ...draft,
    cards: Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      term: "word",
      definition: "meaning",
    })),
  };
  const edited = {
    ...stored,
    updatedAt: 3,
    cards: stored.cards.map((card, i) =>
      i === 500 ? { ...card, term: "changed" } : card,
    ),
  };
  const writes = vi.spyOn(localStorage, "setItem");
  journalDraft("one", edited, stored);
  expect(
    writes.mock.calls.filter(([key]) => key.includes(":card:")),
  ).toHaveLength(1);
  expect(
    writes.mock.calls.reduce((size, [, value]) => size + value.length, 0),
  ).toBeLessThan(10000);
  expect(recoverDraft("one", stored.id, stored)?.cards[500].term).toBe(
    "changed",
  );
  writes.mockClear();
  const next = {
    ...edited,
    updatedAt: 4,
    cards: edited.cards.map((card, i) =>
      i === 501 ? { ...card, definition: "new" } : card,
    ),
  };
  journalDraft("one", next, edited);
  expect(writes.mock.calls).toHaveLength(2);
  const reordered = {
    ...next,
    updatedAt: 5,
    cards: next.cards.slice(1).reverse(),
  };
  journalDraft("one", reordered, next);
  expect(recoverDraft("one", stored.id, stored)?.cards).toEqual(
    reordered.cards,
  );
  writes.mockRestore();
});
it("clears all journal fragments only for the selected account", () => {
  journalDraft("one", draft);
  journalDraft("two", draft);
  journalDraft(null, draft);
  clearDraftJournals("one");
  expect(recoverDraft("one", draft.id)).toBeUndefined();
  expect(recoverDraft("two", draft.id)?.title).toBe(draft.title);
  expect(recoverDraft(null, draft.id)?.title).toBe(draft.title);
  expect(
    Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i),
    ).some((key) => key?.startsWith("easy-learn-draft-recovery:one:")),
  ).toBe(false);
});
it("reads old journals without bringing back removed images", () => {
  localStorage.setItem(
    "easy-learn-draft-recovery:one:journal",
    JSON.stringify(draft),
  );
  expect(
    recoverDraft("one", draft.id, { ...draft, updatedAt: 1 })?.cards[0].image,
  ).toBeUndefined();
});
