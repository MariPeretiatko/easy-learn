import type { SetDraft } from "../types";
function key(owner: string | null, id: string) {
  return `easy-learn-draft-recovery:${owner ?? "guest"}:${id}`;
}
// Text and card order are journaled synchronously. Large media stays in IndexedDB.
export function journalDraft(owner: string | null, draft: SetDraft) {
  localStorage.setItem(
    key(owner, draft.id),
    JSON.stringify({
      ...draft,
      cards: draft.cards.map(
        ({ image: _image, termImage: _termImage, ...card }) => card,
      ),
    }),
  );
}
export function recoverDraft(
  owner: string | null,
  id: string,
  stored?: SetDraft,
) {
  const raw = localStorage.getItem(key(owner, id));
  if (!raw) return stored;
  try {
    const draft = JSON.parse(raw) as SetDraft;
    if (
      draft.id !== id ||
      typeof draft.title !== "string" ||
      typeof draft.description !== "string" ||
      !Number.isFinite(draft.updatedAt) ||
      !Array.isArray(draft.cards) ||
      draft.cards.some(
        (card) =>
          !card ||
          typeof card.id !== "string" ||
          typeof card.term !== "string" ||
          typeof card.definition !== "string",
      )
    )
      return stored;
    if (stored && stored.updatedAt > draft.updatedAt) return stored;
    return {
      ...draft,
      cards: draft.cards.map((card) => {
        const media = stored?.cards.find((item) => item.id === card.id);
        return { ...card, image: media?.image, termImage: media?.termImage };
      }),
    };
  } catch {
    return stored;
  }
}
export function clearDraftJournal(owner: string | null, id: string) {
  localStorage.removeItem(key(owner, id));
}
