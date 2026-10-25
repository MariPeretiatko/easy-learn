import { expect, it } from "vitest";
import { clearDraftJournal, journalDraft, recoverDraft } from "./draftRecovery";
import type { SetDraft } from "../types";
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
it("retains persisted images and ignores journals older than IndexedDB", () => {
  journalDraft("one", draft);
  expect(
    recoverDraft("one", draft.id, { ...draft, title: "old", updatedAt: 1 })
      ?.cards[0].image,
  ).toBe(draft.cards[0].image);
  expect(
    recoverDraft("one", draft.id, { ...draft, title: "newer", updatedAt: 3 })
      ?.title,
  ).toBe("newer");
  clearDraftJournal("one", draft.id);
  expect(recoverDraft("one", draft.id)).toBeUndefined();
});
