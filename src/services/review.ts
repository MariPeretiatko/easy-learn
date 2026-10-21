import { db } from "../db/database";
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
    db.words,
    db.reviews,
    db.statistics,
    db.decks,
    async () => {
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
      await db.reviews.add({
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
    [db.words, db.reviews, db.statistics, db.decks],
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
