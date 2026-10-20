import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
export function useData() {
  return useLiveQuery(async () => ({
    words: await db.words.toArray(),
    decks: await db.decks.toArray(),
    texts: await db.texts.toArray(),
    videos: await db.videos.toArray(),
    statistics: await db.statistics.orderBy("date").toArray(),
    recent: await db.recent.orderBy("timestamp").reverse().limit(6).toArray(),
  }));
}
