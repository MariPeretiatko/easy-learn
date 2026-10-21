import Dexie, { type Table } from "dexie";
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
  constructor() {
    super("easy-learn");
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
  }
}
export const db = new LearningDatabase();
