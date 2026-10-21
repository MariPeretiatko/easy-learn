import { expect, it } from "vitest";
import { newWord } from "../../services/wordModel";
import {
  initialLearningProgress,
  advanceLearning,
  learningOrder,
} from "./adaptive";
it("requires two consecutive correct answers for new words and one for familiar words", () => {
  const fresh = newWord({ id: "fresh" });
  const known = newWord({ id: "known", status: "review", reviewCount: 8 });
  let progress = initialLearningProgress([fresh, known]);
  expect(progress.fresh.required).toBe(2);
  expect(progress.known.required).toBe(1);
  const first = advanceLearning(
    progress,
    [known],
    [{ word: fresh, correct: true }],
  );
  expect(first.queue.map((w) => w.id)).toEqual(["known", "fresh"]);
  const second = advanceLearning(
    first.progress,
    [fresh],
    [{ word: known, correct: true }],
  );
  expect(second.progress.known.streak).toBe(1);
  const final = advanceLearning(
    second.progress,
    [],
    [{ word: fresh, correct: true }],
  );
  expect(final.queue).toEqual([]);
});
it("returns mistakes after three other tasks and resets the success streak", () => {
  const words = Array.from({ length: 6 }, (_, i) => newWord({ id: String(i) }));
  const progress = initialLearningProgress(words);
  progress["0"].streak = 1;
  const step = advanceLearning(progress, words.slice(1), [
    { word: words[0], correct: false },
  ]);
  expect(step.queue.map((w) => w.id)).toEqual(["1", "2", "3", "0", "4", "5"]);
  expect(step.progress["0"]).toEqual({ streak: 0, required: 2 });
  expect(progress["0"].streak).toBe(1);
});
it("removes mastered targets from pending work and schedules each mistaken pair separately", () => {
  const [a, b, c] = ["a", "b", "c"].map((id) =>
    newWord({ id, status: "mastered", reviewCount: 5 }),
  );
  const step = advanceLearning(
    initialLearningProgress([a, b, c]),
    [b, c],
    [
      { word: a, correct: true },
      { word: b, correct: false },
      { word: c, correct: true },
    ],
  );
  expect(step.queue.map((w) => w.id)).toEqual(["b"]);
  expect(step.progress.b).toEqual({ streak: 0, required: 2 });
});
it("prioritizes new material before familiar words scheduled for the future", () => {
  const future = newWord({
    id: "future",
    status: "mastered",
    nextReviewAt: 2000,
  });
  const due = newWord({ id: "due", status: "review", nextReviewAt: 0 });
  const fresh = newWord({ id: "fresh", status: "new" });
  expect(learningOrder([future, due, fresh], 1000).map((w) => w.id)).toEqual([
    "fresh",
    "due",
    "future",
  ]);
});
it("a familiar word that was answered wrongly needs two successful recalls", () => {
  const word = newWord({ id: "word", reviewCount: 20, status: "mastered" });
  const wrong = advanceLearning(
    initialLearningProgress([word]),
    [],
    [{ word, correct: false }],
  );
  const first = advanceLearning(wrong.progress, [], [{ word, correct: true }]);
  expect(first.queue).toHaveLength(1);
  expect(
    advanceLearning(first.progress, [], [{ word, correct: true }]).queue,
  ).toHaveLength(0);
});
