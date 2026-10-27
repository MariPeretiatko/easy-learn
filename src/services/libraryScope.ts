import type { Collection, Deck } from "../types";
/** Scope old collections by their contents; unknown empty legacy records belong to the original German workspace. */
export function collectionsForLanguage(
  collections: Collection[],
  decks: Deck[],
  language: string,
) {
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  const childLanguages = new Map<string, string[]>();
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const contentLanguages = (item: Collection) =>
    item.deckIds.flatMap((id) => deckById.get(id)?.language ?? []);
  const moduleLanguages = new Map<string, string[]>(
    collections
      .filter((item) => item.kind !== "folder")
      .map((item) => {
        const inherited = collectionById.get(item.folderId ?? "")?.language;
        const languages = item.language
          ? [item.language]
          : contentLanguages(item);
        const resolved = languages.length ? languages : [inherited ?? "de"];
        if (item.folderId)
          childLanguages.set(item.folderId, [
            ...(childLanguages.get(item.folderId) ?? []),
            ...resolved,
          ]);
        return [item.id, resolved];
      }),
  );
  const visible = collections.filter((item) => {
    if (item.language) return item.language === language;
    if (item.kind !== "folder")
      return moduleLanguages.get(item.id)?.includes(language);
    const languages = [
      ...contentLanguages(item),
      ...(childLanguages.get(item.id) ?? []),
    ];
    return (languages.length ? languages : ["de"]).includes(language);
  });
  const visibleIds = new Set(visible.map((item) => item.id));
  return visible.map((item) => ({
    ...item,
    deckIds: item.deckIds.filter(
      (id) => deckById.get(id)?.language === language,
    ),
    ...(item.folderId && !visibleIds.has(item.folderId)
      ? { folderId: undefined }
      : {}),
  }));
}
