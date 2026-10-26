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
it("incremental rebuild touches only affected cards and days and agrees with full replay", async () => {
  const database = new LearningDatabase(`test-${crypto.randomUUID()}`);
  try {
    await database.localOnly(async () => {
      const baseline = newWord({
        id: "changed",
        term: "Haus",
        translation: "дом",
      });
      await database.words.bulkPut([
        baseline,
        newWord({
          id: "untouched",
          term: "Baum",
          translation: "дерево",
          reviewCount: 99,
        }),
      ]);
      const review = {
        id: "r",
        wordId: "changed",
        result: "good" as const,
        timestamp: 10,
        responseTime: 1,
        baseline,
      };
      await database.reviews.put(review);
      const activity = {
        id: "a",
        date: "2026-10-25",
        patch: { wordsReviewed: 1 },
      };
      await database.activity.put(activity);
      await database.statistics.put({
        date: "2026-10-24",
        wordsReviewed: 77,
        wordsAdded: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        studyMinutes: 0,
        readingMinutes: 0,
        listeningMinutes: 0,
      });
      await rebuildDerived(database, [
        { table: "reviews", key: "r", before: null, value: review },
        { table: "activity", key: "a", before: null, value: activity },
      ]);
      expect((await database.words.get("untouched"))?.reviewCount).toBe(99);
      expect((await database.statistics.get("2026-10-24"))?.wordsReviewed).toBe(
        77,
      );
      const changed = await database.words.get("changed");
      const day = await database.statistics.get("2026-10-25");
      await rebuildDerived(database);
      expect(await database.words.get("changed")).toEqual(changed);
      expect(await database.statistics.get("2026-10-25")).toEqual(day);
      await database.reviews.delete("r");
      await rebuildDerived(database, [
        { table: "reviews", key: "r", before: review, value: null },
      ]);
      expect((await database.words.get("changed"))?.reviewCount).toBe(0);
    });
  } finally {
    await database.delete();
  }
});
it("does not rewrite unchanged progress or statistics during repeated replay", async () => {
  const { vi } = await import("vitest");
  const database = new LearningDatabase(`test-${crypto.randomUUID()}`);
  try {
    await database.localOnly(async () => {
      const baseline = newWord({ id: "w", term: "Haus", translation: "дом" });
      const event = {
        id: "r",
        wordId: "w",
        timestamp: 1,
        result: "good" as const,
        responseTime: 1,
        baseline,
        deckId: "d",
      };
      await database.words.put(baseline);
      await database.reviews.put(event);
      await rebuildDerived(database);
      const words = vi.spyOn(database.words, "bulkPut");
      const statistics = vi.spyOn(database.statistics, "bulkPut");
      await rebuildDerived(database, [
        { table: "reviews", key: "r", before: event, value: event },
      ]);
      expect(words).not.toHaveBeenCalled();
      expect(statistics).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  } finally {
    await database.delete();
  }
});
