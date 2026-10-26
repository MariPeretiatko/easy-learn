import type { Word } from "../../types";
import { shuffled } from "../../utils/format";
export type ExerciseType =
  "choice" | "typing" | "listening" | "boolean" | "matching";
export interface Question {
  word: Word;
  type: ExerciseType;
  prompt: string;
  answer: string;
  options: string[];
  reverse: boolean;
  candidate?: string;
  pairs?: Word[];
}
export const exerciseNames: Record<ExerciseType, string> = {
  boolean: "Верно / неверно",
  choice: "Выбор ответа",
  matching: "Подбор",
  typing: "Ввести ответ",
  listening: "На слух",
};
export function createQuestion(
  word: Word,
  words: Word[],
  type: ExerciseType,
  reverse = false,
): Question {
  const answer = reverse ? word.term : word.translation;
  const accepted = [
    answer,
    ...(reverse
      ? (word.acceptedTerms ?? [])
      : (word.acceptedTranslations ?? [])),
  ];
  const others = shuffled(
    [
      ...new Set(
        words
          .filter(
            (item) =>
              item.id !== word.id &&
              (reverse
                ? item.translation !== word.translation
                : item.term !== word.term),
          )
          .map((item) => (reverse ? item.term : item.translation)),
      ),
    ].filter(
      (value) =>
        !accepted.some((valid) =>
          isCorrect(value, valid, {
            language: reverse ? word.language : word.nativeLanguage,
            strictAnswerArticles: false,
          }),
        ),
    ),
  );
  const options = shuffled([answer, ...others.slice(0, 3)]);
  if (type === "choice" && options.length < 2) type = "typing";
  const candidate = Math.random() > 0.5 || !others.length ? answer : others[0];
  const terms = new Set<string>();
  const translations = new Set<string>();
  const pairs = [word, ...shuffled(words.filter((item) => item.id !== word.id))]
    .filter((item) => {
      if (terms.has(item.term) || translations.has(item.translation))
        return false;
      terms.add(item.term);
      translations.add(item.translation);
      return true;
    })
    .slice(0, 4);
  if (type === "matching" && pairs.length < 2) type = "typing";
  return {
    word,
    type,
    reverse,
    prompt: reverse ? word.translation : word.term,
    answer:
      type === "listening"
        ? word.term
        : type === "boolean"
          ? candidate === answer
            ? "Верно"
            : "Неверно"
          : type === "matching"
            ? pairs
                .map((item) => `${item.term} — ${item.translation}`)
                .join("; ")
            : answer,
    options: type === "boolean" ? ["Верно", "Неверно"] : options,
    candidate,
    ...(type === "matching" ? { pairs } : {}),
  };
}
export interface AnswerRules {
  strictAnswerCase?: boolean;
  strictAnswerArticles?: boolean;
  language?: string;
}
export function isCorrect(
  answer: string,
  expected: string,
  rules: AnswerRules = {},
) {
  const clean = (value: string) => {
    let result = value.normalize("NFC").trim().replace(/\s+/g, " ");
    if (rules.language === "de" && rules.strictAnswerArticles === false)
      result = result.replace(
        /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+/i,
        "",
      );
    return rules.strictAnswerCase ? result : result.toLocaleLowerCase();
  };
  return !!clean(answer) && clean(answer) === clean(expected);
}
export function isAnswerCorrect(
  answer: string,
  question: Question,
  rules: AnswerRules = {},
) {
  if (question.type !== "typing" && question.type !== "listening")
    return answer === question.answer;
  const termAnswer = question.type === "listening" || question.reverse;
  const alternatives = termAnswer
    ? question.word.acceptedTerms
    : question.word.acceptedTranslations;
  return [question.answer, ...(alternatives ?? [])]
    .filter((value) => value.trim())
    .some((expected) =>
      isCorrect(answer, expected, {
        ...rules,
        language: termAnswer
          ? question.word.language
          : question.word.nativeLanguage,
      }),
    );
}
