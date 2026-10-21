import type { Word } from "../../types";
import { shuffled } from "../../utils/format";
export interface LearningProgress {
  streak: number;
  required: number;
}
export type LearningProgressMap = Record<string, LearningProgress>;
export function initialLearningProgress(words: Word[]): LearningProgressMap {
  return Object.fromEntries(
    words.map((word) => [
      word.id,
      {
        streak: 0,
        required:
          word.reviewCount > 0 &&
          (word.status === "review" || word.status === "mastered")
            ? 1
            : 2,
      },
    ]),
  );
}
export function learningOrder(words: Word[], now = Date.now()) {
  const priority = (word: Word) =>
    word.status === "new" || word.status === "learning"
      ? 0
      : word.nextReviewAt <= now
        ? 1
        : 2;
  return shuffled(words).sort((a, b) => priority(a) - priority(b));
}
export function advanceLearning(
  previous: LearningProgressMap,
  remaining: Word[],
  assessed: { word: Word; correct: boolean }[],
) {
  const progress = { ...previous };
  for (const { word, correct } of assessed) {
    const current = progress[word.id];
    if (!current) continue;
    progress[word.id] = correct
      ? { ...current, streak: current.streak + 1 }
      : { streak: 0, required: 2 };
  }
  const complete = (word: Word) =>
    progress[word.id]?.streak >= progress[word.id]?.required;
  const queue = remaining.filter((word) => !complete(word));
  const retry = assessed
    .filter(
      ({ word }) =>
        !complete(word) && !queue.some((item) => item.id === word.id),
    )
    .map(({ word }) => word);
  // Leave three other tasks between attempts whenever enough material remains.
  queue.splice(
    Math.min(3, queue.length),
    0,
    ...new Map(retry.map((word) => [word.id, word])).values(),
  );
  return { progress, queue };
}
