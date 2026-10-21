import type { Collection, Deck, RecentItem } from "../types";

export function recentStudyItems(data: {
  recent: RecentItem[];
  decks: Deck[];
  collections: Collection[];
}) {
  return data.recent
    .flatMap((item) => {
      const entity =
        item.kind === "decks"
          ? data.decks.find((deck) => deck.id === item.id)
          : item.kind === "modules"
            ? data.collections.find(
                (collection) =>
                  collection.id === item.id && collection.kind === "course",
              )
            : undefined;
      return entity
        ? [
            {
              ...item,
              title: entity.title,
              to: `/${item.kind === "decks" ? "sets" : "modules"}/${item.id}`,
            },
          ]
        : [];
    })
    .slice(0, 5);
}
