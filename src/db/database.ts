import Dexie, { type Table } from "dexie";
import type {
  Word,
  Deck,
  TextDocument,
  Video,
  ReviewHistory,
  DailyStatistics,
  RecentItem,
} from "../types";
export class LearningDatabase extends Dexie {
  words!: Table<Word, string>;
  decks!: Table<Deck, string>;
  texts!: Table<TextDocument, string>;
  videos!: Table<Video, string>;
  reviews!: Table<ReviewHistory, string>;
  statistics!: Table<DailyStatistics, string>;
  recent!: Table<RecentItem, string>;
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
  }
}
export const db = new LearningDatabase();
