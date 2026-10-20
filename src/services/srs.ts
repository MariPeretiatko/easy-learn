import type { Rating, Word } from "../types";
export function scheduleReview(
  word: Pick<Word, "interval" | "difficulty" | "reviewCount">,
  rating: Rating,
  now = Date.now(),
): Pick<Word, "interval" | "difficulty" | "status" | "nextReviewAt"> {
  const previous = Math.max(0, word.interval);
  const difficulty = Math.max(
    1,
    Math.min(
      5,
      word.difficulty +
        (rating === "again"
          ? 1
          : rating === "hard"
            ? 0.3
            : rating === "easy"
              ? -0.5
              : -0.15),
    ),
  );
  const interval =
    rating === "again"
      ? 10 / 1440
      : rating === "hard"
        ? Math.max(1, previous * 1.2)
        : rating === "good"
          ? Math.max(1, previous * (2.6 - difficulty * 0.12))
          : Math.max(4, previous * (3.6 - difficulty * 0.12));
  const rounded =
    rating === "again"
      ? interval
      : Math.min(365, Math.round(interval * 10) / 10);
  return {
    interval: rounded,
    difficulty: Math.round(difficulty * 10) / 10,
    status:
      rating === "again"
        ? "learning"
        : rounded >= 21
          ? "mastered"
          : word.reviewCount >= 1
            ? "review"
            : "learning",
    nextReviewAt: now + rounded * 86400000,
  };
}
