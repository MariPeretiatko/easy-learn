import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import type { Word } from "../../types";
export function useSetData(id?: string) {
  return useLiveQuery(async () => {
    const [deck, decks, collections] = await Promise.all([
      db.decks.get(id ?? ""),
      db.decks.toArray(),
      db.collections.toArray(),
    ]);
    const words = deck
      ? (await db.words.bulkGet(deck.wordIds)).filter(
          (word): word is Word => !!word,
        )
      : [];
    return { deck, decks, collections, words };
  }, [id]);
}
