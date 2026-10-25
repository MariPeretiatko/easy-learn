import type { Collection } from "../types";
import { db } from "../db/database";

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
      if (decks.some((deck) => deck?.language !== collection.language))
        throw new Error("Все колоды модуля должны быть на выбранном языке");
    }
    if (collection.folderId) {
      const parent = await db.collections.get(collection.folderId);
      if (collection.kind !== "course" || parent?.kind !== "folder")
        throw new Error("Выберите существующую папку для модуля");
    }
    await db.collections.put({
      ...collection,
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
