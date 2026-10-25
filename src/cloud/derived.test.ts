import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { LearningDatabase } from "../db/database";
import { newWord } from "../services/wordModel";
import { rebuildDerived } from "./derived";
it("replays concurrent review and activity events deterministically without double counting", async () => {
  const database = new LearningDatabase(`test-${crypto.randomUUID()}`);
  try {
    const baseline = newWord({
      id: "word",
      term: "Haus",
      translation: "дом",
      reviewCount: 3,
      correctCount: 2,
      incorrectCount: 1,
    });
    await database.localOnly(async () => {
      await database.words.put(baseline);
      await database.reviews.bulkPut([
        {
          id: "b",
          wordId: "word",
          result: "again",
          timestamp: 20,
          responseTime: 100,
          baseline,
        },
        {
          id: "a",
          wordId: "word",
          result: "good",
          timestamp: 10,
          responseTime: 100,
          baseline,
        },
        {
          id: "legacy",
          wordId: "word",
          result: "good",
          timestamp: 1,
          responseTime: 100,
        },
      ]);
      await database.activity.bulkPut([
        {
          id: "a",
          date: "2026-10-25",
          patch: { wordsReviewed: 1, correctAnswers: 1 },
        },
        {
          id: "b",
          date: "2026-10-25",
          patch: { wordsReviewed: 1, incorrectAnswers: 1 },
        },
      ]);
      await rebuildDerived(database);
    });
    expect(await database.words.get("word")).toMatchObject({
      reviewCount: 5,
      correctCount: 3,
      incorrectCount: 2,
      status: "learning",
    });
    const state = await database.words.get("word");
    await database.localOnly(() => rebuildDerived(database));
    expect(await database.words.get("word")).toEqual(state);
    expect(await database.statistics.get("2026-10-25")).toMatchObject({
      wordsReviewed: 2,
      correctAnswers: 1,
      incorrectAnswers: 1,
    });
    await database.localOnly(async () => {
      await database.words.update("word", {
        manualProgress: { at: 30, status: "mastered", nextReviewAt: 99999 },
      });
      await rebuildDerived(database);
    });
    expect(await database.words.get("word")).toMatchObject({
      status: "mastered",
      nextReviewAt: 99999,
      reviewCount: 5,
    });
    expect(await database.outbox.count()).toBe(0);
  } finally {
    await database.delete();
  }
});
