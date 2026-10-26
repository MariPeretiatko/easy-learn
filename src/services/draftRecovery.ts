import type { SetDraft } from "../types";
import { withoutCardImages } from "../cloud/images";
function ownerPrefix(owner: string | null) {
  return `easy-learn-draft-recovery:${owner ?? "guest"}:`;
}
function key(owner: string | null, id: string) {
  return `${ownerPrefix(owner)}${id}`;
}
// Journal only changed cards; large drafts are never serialized on every keypress.
export function journalDraft(
  owner: string | null,
  draft: SetDraft,
  previous?: SetDraft,
) {
  const base = key(owner, draft.id);
  const oldCards = new Map(previous?.cards.map((card) => [card.id, card]));
  const initialized = localStorage.getItem(`${base}:order`) !== null;
  // Loaded drafts already have an IndexedDB baseline; standalone journals include every card.
  for (const card of draft.cards)
    if (!previous || oldCards.get(card.id) !== card)
      localStorage.setItem(
        `${base}:card:${card.id}`,
        JSON.stringify(withoutCardImages(card)),
      );
  const orderChanged =
    !initialized ||
    !previous ||
    previous.cards.length !== draft.cards.length ||
    draft.cards.some((card, index) => previous.cards[index]?.id !== card.id);
  if (orderChanged)
    localStorage.setItem(
      `${base}:order`,
      JSON.stringify(draft.cards.map((card) => card.id)),
    );
  const { cards: _cards, ...metadata } = draft;
  localStorage.setItem(base, JSON.stringify({ version: 2, ...metadata }));
}
export function recoverDraft(
  owner: string | null,
  id: string,
  stored?: SetDraft,
) {
  const base = key(owner, id);
  const raw = localStorage.getItem(base);
  const cleanStored = stored ? withoutCardImages(stored) : undefined;
  if (!raw) return cleanStored;
  try {
    const draft = JSON.parse(raw);
    if (draft.version === 2) {
      const order: unknown = JSON.parse(
        localStorage.getItem(`${base}:order`) ?? "null",
      );
      if (
        !Array.isArray(order) ||
        !order.every((entry) => typeof entry === "string")
      )
        return cleanStored;
      const storedCards = new Map(stored?.cards.map((card) => [card.id, card]));
      draft.cards = order.map((cardId) => {
        const card = localStorage.getItem(`${base}:card:${cardId}`);
        return card ? JSON.parse(card) : storedCards.get(cardId);
      });
      delete draft.version;
    }
    if (
      draft.id !== id ||
      typeof draft.title !== "string" ||
      typeof draft.description !== "string" ||
      !Number.isFinite(draft.updatedAt) ||
      !Array.isArray(draft.cards) ||
      draft.cards.some(
        (card: unknown) =>
          !card ||
          typeof card !== "object" ||
          typeof (card as Record<string, unknown>).id !== "string" ||
          typeof (card as Record<string, unknown>).term !== "string" ||
          typeof (card as Record<string, unknown>).definition !== "string",
      )
    )
      return cleanStored;
    if (stored && stored.updatedAt > draft.updatedAt) return cleanStored;
    return withoutCardImages(draft) as SetDraft;
  } catch {
    return cleanStored;
  }
}
function removeMatching(matches: (entry: string) => boolean) {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const entry = localStorage.key(index);
    if (entry && matches(entry)) keys.push(entry);
  }
  keys.forEach((entry) => localStorage.removeItem(entry));
}
export function clearDraftJournal(owner: string | null, id: string) {
  const base = key(owner, id);
  removeMatching((entry) => entry === base || entry.startsWith(`${base}:`));
}
export function clearDraftJournals(owner: string | null) {
  removeMatching((entry) => entry.startsWith(ownerPrefix(owner)));
}
