import type { Collection } from "../types";
import { db } from "../db/database";
import { useSettings } from "../store/useSettings";
import { collectionsForLanguage } from "./libraryScope";

export function collectionDeckIds(
  collection: Collection,
  collections: Collection[],
) {
  return [
    ...new Set([
      ...collection.deckIds,
      ...collections
        .filter(
          (item) =>
            collection.kind === "folder" &&
            item.kind === "course" &&
            item.folderId === collection.id,
        )
        .flatMap((item) => item.deckIds),
    ]),
  ];
}

export async function deleteCollection(id: string) {
  await db.transaction("rw", db.collections, async () => {
    for (const child of await db.collections.toArray()) {
      if (child.folderId === id)
        await db.collections.put({ ...child, folderId: undefined });
    }
    await db.collections.delete(id);
  });
}

export async function saveCollection(collection: Collection) {
  return db.transaction("rw", [db.collections, db.decks], async () => {
    if (!collection.title.trim()) throw new Error("Введите название");
    const decks = await db.decks.bulkGet(collection.deckIds);
    if (decks.some((deck) => !deck))
      throw new Error("Одна из колод был удалён");
    if (collection.kind === "course") {
      if (!collection.language) throw new Error("Выберите язык модуля");
    }
    const language =
      collection.language ??
      decks[0]?.language ??
      useSettings.getState().settings.learningLanguage;
    if (decks.some((deck) => deck?.language !== language))
      throw new Error("Все колоды должны быть на выбранном языке");
    if (collection.kind === "folder") {
      const children = await db.collections
        .where("folderId")
        .equals(collection.id)
        .toArray();
      const childDecks = await db.decks.bulkGet(
        children.flatMap((child) => child.deckIds),
      );
      if (
        children.some(
          (child) => child.language && child.language !== language,
        ) ||
        childDecks.some((deck) => deck && deck.language !== language)
      )
        throw new Error("Все модули папки должны быть на выбранном языке");
    }
    if (collection.folderId) {
      const parent = await db.collections.get(collection.folderId);
      if (collection.kind !== "course" || parent?.kind !== "folder")
        throw new Error("Выберите существующую папку для модуля");
      const matching = collectionsForLanguage(
        await db.collections.toArray(),
        await db.decks.toArray(),
        language,
      );
      if (!matching.some((item) => item.id === parent.id))
        throw new Error("Папка и модуль должны быть на одном языке");
    }
    await db.collections.put({
      ...collection,
      language,
      title: collection.title.trim(),
      updatedAt: Date.now(),
    });
  });
}

export async function setCollectionDeckMembership(
  collectionId: string,
  deckId: string,
  included: boolean,
) {
  await db.transaction("rw", [db.collections, db.decks], async () => {
    const collection = await db.collections.get(collectionId);
    if (!collection) throw new Error("Модуль или папка больше не существует");
    await saveCollection({
      ...collection,
      deckIds: included
        ? [...new Set([...collection.deckIds, deckId])]
        : collection.deckIds.filter((id) => id !== deckId),
    });
  });
}
