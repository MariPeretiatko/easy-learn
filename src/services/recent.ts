import { collectionsForLanguage } from "./libraryScope";
import type { Collection, Deck, RecentItem } from "../types";

export function recentStudyItems(
  data: {
    recent: RecentItem[];
    decks: Deck[];
    collections: Collection[];
  },
  language?: string,
) {
  if (language)
    data = {
      ...data,
      decks: data.decks.filter((deck) => deck.language === language),
      collections: collectionsForLanguage(
        data.collections,
        data.decks,
        language,
      ),
    };
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

export function compareLibraryCollections(
  a: Collection,
  b: Collection,
  sort: string,
  recent: RecentItem[],
  collections: Collection[],
) {
  const titleOrder = a.title.localeCompare(b.title, "ru", { numeric: true });
  if (sort === "title") {
    const folder = (item: Collection) =>
      collections.find((parent) => parent.id === item.folderId)?.title ?? "";
    return (
      folder(a).localeCompare(folder(b), "ru", { numeric: true }) || titleOrder
    );
  }
  const opened = (item: Collection) =>
    recent.find((entry) => entry.kind === "modules" && entry.id === item.id)
      ?.timestamp ?? item.updatedAt;
  return (
    (sort === "created" ? b.createdAt - a.createdAt : opened(b) - opened(a)) ||
    titleOrder
  );
}
