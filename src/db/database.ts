import Dexie, { type Table } from "dexie";
import { syncMiddleware, markLocalOnly } from "./syncMiddleware";
import type {
  PendingOperation,
  SyncConflict,
  SyncMeta,
  RecordValue,
} from "../cloud/types";
import type {
  Word,
  Deck,
  TextDocument,
  Video,
  ReviewHistory,
  DailyStatistics,
  RecentItem,
  SetDraft,
  Collection,
  Solution,
  TestResult,
} from "../types";
export class LearningDatabase extends Dexie {
  words!: Table<Word, string>;
  decks!: Table<Deck, string>;
  texts!: Table<TextDocument, string>;
  videos!: Table<Video, string>;
  reviews!: Table<ReviewHistory, string>;
  statistics!: Table<DailyStatistics, string>;
  recent!: Table<RecentItem, string>;
  drafts!: Table<SetDraft, string>;
  collections!: Table<Collection, string>;
  solutions!: Table<Solution, string>;
  testResults!: Table<TestResult, string>;
  outbox!: Table<PendingOperation, string>;
  syncMeta!: Table<SyncMeta, string>;
  conflicts!: Table<SyncConflict, string>;
  preferences!: Table<RecordValue & { id: string }, string>;
  activity!: Table<RecordValue & { id: string }, string>;
  constructor(public readonly owner: string | null = null) {
    super(owner ? `easy-learn-user-${owner}` : "easy-learn");
    this.version(1).stores({
      words: "id, term, language, status, nextReviewAt, *tags",
      decks: "id, language, updatedAt",
      texts: "id, language, updatedAt",
      videos: "id, language, createdAt",
      reviews: "id, wordId, timestamp",
      statistics: "date",
      recent: "key, timestamp",
    });
    this.version(2).stores({
      drafts: "id, updatedAt, sourceDeckId",
      collections: "id, kind, updatedAt",
      solutions: "id, updatedAt",
      testResults: "id, deckId, timestamp",
    });
    if (owner) {
      this.version(3).stores({
        outbox: "id, createdAt",
        syncMeta: "key",
        conflicts: "id, createdAt",
        preferences: "id",
        activity: "id, date",
      });
      this.version(4)
        .stores({ outbox: "id, createdAt, order" })
        .upgrade(async (tx) => {
          const operations = await tx
            .table("outbox")
            .orderBy("createdAt")
            .toArray();
          let order = 0;
          for (const operation of operations)
            await tx.table("outbox").put({ ...operation, order: ++order });
          await tx
            .table("syncMeta")
            .put({ key: "outboxSequence", value: order });
        });
    }
    this.use(syncMiddleware(owner));
  }
  async localOnly<T>(action: () => Promise<T>): Promise<T> {
    return this.transaction("rw", this.tables, async (tx) => {
      markLocalOnly(tx.idbtrans);
      return action();
    });
  }
}
let active = new LearningDatabase();
// A transaction keeps its original database even while the active account changes.
export const db: LearningDatabase = new Proxy(active, {
  get(_target, property) {
    const source =
      Dexie.currentTransaction?.db instanceof LearningDatabase
        ? Dexie.currentTransaction.db
        : active;
    const value = Reflect.get(source, property, source);
    return typeof value === "function" ? value.bind(source) : value;
  },
});
export function currentDatabase() {
  return active;
}
export async function selectDatabase(owner: string | null) {
  if (active.owner === owner) return active;
  const previous = active;
  await previous.transaction("rw", previous.tables, async () => undefined);
  active = new LearningDatabase(owner);
  await active.open();
  previous.close();
  return active;
}
