import { db } from "../db/database";
import { newWord, wordIdentity } from "./wordModel";
import type { Collection, Language, Word } from "../types";

export const germanLibraryMarker = "easy-learn-import-deutsch-a1-a2-b1-ru-v1";
export interface LibraryBundle {
  id: string;
  legacyCollectionIds?: string[];
  language: Language;
  nativeLanguage: string;
  folders: {
    id: string;
    title: string;
    modules: {
      id: string;
      title: string;
      decks: {
        id: string;
        title: string;
        cards: {
          term: string;
          translation: string;
          example?: string;
          sourceDeckId?: string;
          sourceCardIndex?: number;
        }[];
      }[];
    }[];
  }[];
}

// A single transaction keeps partially imported libraries out of IndexedDB.
export async function importLibrary(bundle: LibraryBundle) {
  return db.transaction("rw", db.words, db.decks, db.collections, async () => {
    const words = new Map(
      (await db.words.toArray()).map((word) => [wordIdentity(word), word]),
    );
    const collections = await db.collections.toArray();
    const existingDecks = new Map(
      (await db.decks.toArray()).map((deck) => [deck.id, deck]),
    );
    const added: Word[] = [];
    let deckCount = 0;
    const now = Date.now();
    const collection = (
      id: string,
      title: string,
      kind: "folder" | "course",
      folderId?: string,
    ) =>
      collections.find((item) => item.id === id) ??
      collections.find(
        (item) =>
          item.kind === kind &&
          item.title === title &&
          (kind === "folder" ||
            (item.language === bundle.language && item.folderId === folderId)),
      );
    const saveGroup = async (
      id: string,
      title: string,
      kind: "folder" | "course",
      deckIds: string[],
      folderId?: string,
    ) => {
      const previous = collection(id, title, kind, folderId);
      const value: Collection = previous
        ? {
            ...previous,
            ...(folderId ? { folderId } : {}),
            deckIds: [...new Set([...previous.deckIds, ...deckIds])],
          }
        : {
            id,
            title,
            kind,
            ...(folderId ? { folderId } : {}),
            description: "",
            deckIds,
            ...(kind === "course" ? { language: bundle.language } : {}),
            createdAt: now,
            updatedAt: now,
          };
      await db.collections.put(value);
      if (!previous) collections.push(value);
    };
    for (const folder of bundle.folders) {
      const folderDecks: string[] = [];
      const parentId =
        collection(folder.id, folder.title, "folder")?.id ?? folder.id;
      for (const module of folder.modules) {
        const moduleDecks: string[] = [];
        for (const deck of module.decks) {
          if (!deck.title.trim() || !deck.cards.length)
            throw new Error("В файле есть пустая колода");
          if (existingDecks.has(deck.id)) {
            moduleDecks.push(deck.id);
            folderDecks.push(deck.id);
            deckCount++;
            continue;
          }
          const wordIds: string[] = [];
          for (const card of deck.cards) {
            if (!card.term.trim() || !card.translation.trim())
              throw new Error("В карточке отсутствует слово или перевод");
            const fields = {
              term: card.term,
              translation: card.translation,
              example: card.example ?? "",
              language: bundle.language,
              nativeLanguage: bundle.nativeLanguage,
            };
            const identity = wordIdentity(fields);
            let word = words.get(identity);
            if (!word) {
              let hash1 = 2166136261,
                hash2 = 5381;
              for (const char of identity) {
                hash1 = Math.imul(hash1 ^ char.charCodeAt(0), 16777619);
                hash2 = Math.imul(hash2, 33) ^ char.charCodeAt(0);
              }
              const stableId = `catalog-${(hash1 >>> 0).toString(16).padStart(8, "0")}${(hash2 >>> 0).toString(16).padStart(8, "0")}`;
              word = newWord({ ...fields, id: stableId });
              words.set(identity, word);
              added.push(word);
            }
            if (!wordIds.includes(word.id)) wordIds.push(word.id);
          }
          // Preserve any edits made to an already imported deck.
          if (!existingDecks.has(deck.id)) {
            await db.decks.add({
              id: deck.id,
              title: deck.title,
              description: "",
              language: bundle.language,
              tags: [module.title],
              wordIds,
              createdAt: now,
              updatedAt: now,
              favorite: false,
            });
          }
          moduleDecks.push(deck.id);
          folderDecks.push(deck.id);
          deckCount++;
        }
        await saveGroup(
          module.id,
          module.title,
          "course",
          moduleDecks,
          parentId,
        );
      }
      await saveGroup(
        folder.id,
        folder.title,
        "folder",
        bundle.id.endsWith("-v2") ? [] : folderDecks,
      );
    }
    if (added.length) await db.words.bulkAdd(added);
    return { addedWords: added.length, decks: deckCount };
  });
}

export const organizedLibraryMarker =
  "easy-learn-import-deutsch-a1-a2-b1-ru-v2";
export function libraryMarker(marker: string) {
  return db.owner ? `${marker}:${db.owner}` : marker;
}
export async function importPreparedGermanLibrary() {
  if (localStorage.getItem(libraryMarker(organizedLibraryMarker))) return;
  const { default: url } = await import("../data/deutsch-organized.json?url");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Не удалось загрузить учебную библиотеку");
  const data: LibraryBundle = await response.json();
  if (
    localStorage.getItem(libraryMarker(germanLibraryMarker)) ||
    (await db.decks.toArray()).some((deck) =>
      /^deutsch-[a-f0-9]{24}$/.test(deck.id),
    )
  ) {
    const { reorganizeGermanLibrary } = await import("./libraryReorganization");
    await db.localOnly(() => reorganizeGermanLibrary(data as LibraryBundle));
  } else {
    await db.localOnly(() => importLibrary(data as LibraryBundle));
  }
  localStorage.setItem(libraryMarker(germanLibraryMarker), "done");
  localStorage.setItem(libraryMarker(organizedLibraryMarker), "done");
}
