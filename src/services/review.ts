import Dexie from "dexie";
import { db } from "../db/database";
import { markReview } from "../db/syncMiddleware";
import { trackActivity } from "./repositories";
import { uid } from "../utils/format";
import type { Rating, Word } from "../types";
import { scheduleReview } from "./srs";
export async function recordReview(
  word: Word,
  result: Rating,
  responseTime: number,
  deckId?: string,
) {
  await db.transaction(
    "rw",
    [
      db.words,
      db.reviews,
      db.statistics,
      db.decks,
      ...(db.owner ? [db.activity] : []),
    ],
    async () => {
      if (db.owner) markReview(Dexie.currentTransaction!.idbtrans);
      const current = await db.words.get(word.id);
      if (!current) throw new Error("Слово больше не существует");
      const correct = result !== "again";
      await db.words.update(word.id, {
        ...scheduleReview(current, result),
        reviewCount: current.reviewCount + 1,
        correctCount: current.correctCount + Number(correct),
        incorrectCount: current.incorrectCount + Number(!correct),
        lastReviewedAt: Date.now(),
        updatedAt: Date.now(),
      });
      const previousEvent = db.owner
        ? await db.reviews
            .where("[wordId+timestamp]")
            .between([word.id, Dexie.minKey], [word.id, Dexie.maxKey])
            .filter((event) => !!event.baseline)
            .first()
        : undefined;
      const baseline = previousEvent?.baseline ?? current;
      await db.reviews.add({
        ...(db.owner
          ? {
              baseline: { ...baseline, image: undefined, termImage: undefined },
              deckId,
            }
          : {}),
        id: uid(),
        wordId: word.id,
        result,
        timestamp: Date.now(),
        responseTime,
      });
      await trackActivity({
        wordsReviewed: 1,
        correctAnswers: Number(correct),
        incorrectAnswers: Number(!correct),
        studyMinutes: Math.min(responseTime, 300000) / 60000,
      });
      if (deckId) await db.decks.update(deckId, { lastStudiedAt: Date.now() });
    },
  );
}

export interface ReviewAssessment {
  word: Word;
  correct: boolean;
}
/** Persist one exercise's assessments as a unit, dividing its total active time fairly. */
export async function recordReviews(
  assessments: ReviewAssessment[],
  elapsed: number,
  deckId?: string,
) {
  const responseTime =
    Math.max(0, Number.isFinite(elapsed) ? elapsed : 0) /
    Math.max(1, assessments.length);
  await db.transaction(
    "rw",
    [
      db.words,
      db.reviews,
      db.statistics,
      db.decks,
      ...(db.owner ? [db.activity] : []),
    ],
    async () => {
      for (const { word, correct } of assessments)
        await recordReview(
          word,
          correct ? "good" : "again",
          responseTime,
          deckId,
        );
    },
  );
}
