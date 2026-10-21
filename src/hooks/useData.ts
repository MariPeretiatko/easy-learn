import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
const queries = {
  drafts: () => db.drafts.orderBy("updatedAt").reverse().toArray(),
  collections: () => db.collections.orderBy("updatedAt").reverse().toArray(),
  solutions: () => db.solutions.orderBy("updatedAt").reverse().toArray(),
  testResults: () => db.testResults.orderBy("timestamp").reverse().toArray(),
  words: () => db.words.toArray(),
  decks: () => db.decks.toArray(),
  texts: () => db.texts.toArray(),
  videos: () => db.videos.toArray(),
  statistics: () => db.statistics.orderBy("date").toArray(),
  recent: () => db.recent.orderBy("timestamp").reverse().toArray(),
};
type TableName = keyof typeof queries;
type QueryData = { [K in TableName]: Awaited<ReturnType<(typeof queries)[K]>> };
/** Subscribe only to tables used by the caller. A stable key avoids resubscribing on render. */
export function useData<K extends TableName>(tables: readonly K[]) {
  const key = [...tables].sort().join(",");
  return useLiveQuery(
    async () =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (table) => [table, await queries[table]()]),
        ),
      ) as Pick<QueryData, K>,
    [key],
  );
}
