import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "../../db/database";
import { newWord } from "../../services/wordModel";
import { clearData } from "../../services/repositories";
import { createQuestion } from "./engine";
import { saveTestAttempt } from "./quizRepository";
import { assessmentsFor } from "./assessments";
beforeEach(clearData);
it("saves the result, individual reviews and statistics in one commit", async () => {
  const a = newWord({ term: "Haus", translation: "дом" }),
    b = newWord({ term: "Baum", translation: "дерево" });
  await db.words.bulkAdd([a, b]);
  const answers = [
    {
      question: createQuestion(a, [a, b], "typing"),
      answer: "дом",
      correct: true,
    },
    {
      question: createQuestion(b, [a, b], "typing"),
      answer: "wrong",
      correct: false,
    },
  ];
  const id = await saveTestAttempt(answers, 2000, "Мои выбранные модули");
  expect(await db.testResults.get(id)).toMatchObject({
    title: "Мои выбранные модули",
    answers: [
      { given: "дом", correct: true },
      { given: "wrong", correct: false },
    ],
  });
  expect(
    (await db.reviews.toArray()).map((review) => review.responseTime),
  ).toEqual([1000, 1000]);
  expect((await db.words.get(a.id))?.correctCount).toBe(1);
  expect((await db.words.get(b.id))?.incorrectCount).toBe(1);
  expect((await db.statistics.toArray())[0].wordsReviewed).toBe(2);
});
it("rolls back reviews and scheduling if saving the test result fails", async () => {
  const word = newWord({ term: "Haus", translation: "дом" });
  await db.words.add(word);
  const fail = () => {
    throw new Error("Storage failure");
  };
  db.testResults.hook("creating", fail);
  try {
    await expect(
      saveTestAttempt(
        [
          {
            question: createQuestion(word, [word], "typing"),
            answer: "дом",
            correct: true,
          },
        ],
        1000,
        "Test",
      ),
    ).rejects.toThrow("Storage failure");
  } finally {
    db.testResults.hook("creating").unsubscribe(fail);
  }
  expect(await db.reviews.count()).toBe(0);
  expect(await db.statistics.count()).toBe(0);
  expect(await db.testResults.count()).toBe(0);
  expect(await db.words.get(word.id)).toEqual(word);
});
it("attributes matching mistakes only to involved words", () => {
  const words = ["a", "b", "c"].map((term) =>
    newWord({ term, translation: term }),
  );
  const q = createQuestion(words[0], words, "matching");
  const assessments = assessmentsFor({
    question: q,
    answer: "wrong pair",
    correct: false,
    incorrectWordIds: [words[0].id, words[1].id],
  });
  expect(
    assessments
      .filter((item) => !item.correct)
      .map((item) => item.word.id)
      .sort(),
  ).toEqual([words[0].id, words[1].id].sort());
  expect(
    assessments.find((item) => item.word.id === words[2].id)?.correct,
  ).toBe(true);
});
