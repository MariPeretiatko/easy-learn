import { expect, it } from "vitest";
import { newWord } from "../../services/wordModel";
import { createQuestion } from "./engine";

it("builds unambiguous matching questions even with repeated terms and translations", () => {
  const words = [
    newWord({ term: "Haus", translation: "дом" }),
    newWord({ term: "Haus", translation: "здание" }),
    newWord({ term: "Gebäude", translation: "дом" }),
    newWord({ term: "Baum", translation: "дерево" }),
    newWord({ term: "Katze", translation: "кошка" }),
  ];
  const question = createQuestion(words[0], words, "matching");
  expect(question.type).toBe("matching");
  expect(new Set(question.pairs!.map((word) => word.term)).size).toBe(
    question.pairs!.length,
  );
  expect(new Set(question.pairs!.map((word) => word.translation)).size).toBe(
    question.pairs!.length,
  );
  expect(question.pairs!.map((word) => word.id)).toContain(words[0].id);
});
it("keeps listening on the learning language and reverses written answers correctly", () => {
  const word = newWord({ term: "Welt", translation: "мир" });
  expect(createQuestion(word, [word], "listening", true).answer).toBe("Welt");
  expect(createQuestion(word, [word], "typing", true)).toMatchObject({
    prompt: "мир",
    answer: "Welt",
  });
  expect(createQuestion(word, [word], "typing", false)).toMatchObject({
    prompt: "Welt",
    answer: "мир",
  });
});

it("accepts explicitly listed translations and terms without splitting descriptive commas", async () => {
  const { isAnswerCorrect } = await import("./engine");
  const word = newWord({
    term: "lernen",
    translation: "учить, учиться",
    acceptedTranslations: ["учиться", "обучаться"],
    acceptedTerms: ["studieren"],
  });
  expect(
    isAnswerCorrect("учиться", createQuestion(word, [word], "typing")),
  ).toBe(true);
  expect(
    isAnswerCorrect("studieren", createQuestion(word, [word], "typing", true)),
  ).toBe(true);
  expect(isAnswerCorrect("учить", createQuestion(word, [word], "typing"))).toBe(
    false,
  );
  expect(
    isAnswerCorrect("учиться", createQuestion(word, [word], "typing", true)),
  ).toBe(false);
});
it("applies case and German article rules only to written answers", async () => {
  const { isAnswerCorrect } = await import("./engine");
  const word = newWord({ term: "der Hund", translation: "собака" });
  const q = createQuestion(word, [word], "typing", true);
  expect(isAnswerCorrect("Hund", q)).toBe(false);
  expect(isAnswerCorrect("Hund", q, { strictAnswerArticles: false })).toBe(
    true,
  );
  expect(
    isAnswerCorrect("hund", q, {
      strictAnswerArticles: false,
      strictAnswerCase: true,
    }),
  ).toBe(false);
  expect(
    isAnswerCorrect("Hund", q, {
      strictAnswerArticles: false,
      strictAnswerCase: true,
    }),
  ).toBe(true);
  const choice = createQuestion(
    word,
    [word, newWord({ term: "Katze", translation: "кошка" })],
    "choice",
    true,
  );
  expect(isAnswerCorrect("der hund", choice)).toBe(false);
  expect(isAnswerCorrect("der Hund", choice)).toBe(true);
});
it("preserves meaningful signs, decimals and programming-language symbols", async () => {
  const { isCorrect } = await import("./engine");
  for (const [given, expected] of [
    ["2", "-2"],
    ["15", "1.5"],
    ["C", "C++"],
    ["15", "1,5"],
  ])
    expect(isCorrect(given, expected)).toBe(false);
  expect(isCorrect("  C++  ", "C++")).toBe(true);
});
it("never uses an accepted alternative as a wrong option or boolean candidate", () => {
  const word = newWord({
    term: "learn",
    translation: "учить",
    acceptedTranslations: ["учиться"],
  });
  const words = [
    word,
    newWord({ term: "study", translation: "учиться" }),
    newWord({ term: "read", translation: "читать" }),
  ];
  for (let i = 0; i < 20; i++) {
    expect(createQuestion(word, words, "choice").options).not.toContain(
      "учиться",
    );
    expect(createQuestion(word, words, "boolean").candidate).not.toBe(
      "учиться",
    );
  }
});
