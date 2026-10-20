import type { Word } from "../../types";
import { normalize, shuffled } from "../../utils/format";
export type ExerciseType =
  "choice" | "typing" | "listening" | "cloze" | "boolean";
export interface Question {
  word: Word;
  type: ExerciseType;
  prompt: string;
  answer: string;
  options: string[];
  reverse: boolean;
  candidate?: string;
}
export const exerciseNames: Record<ExerciseType, string> = {
  choice: "Выбор ответа",
  typing: "Ввести ответ",
  listening: "На слух",
  cloze: "Пропуск в предложении",
  boolean: "Верно / неверно",
};
export function createQuestion(
  word: Word,
  words: Word[],
  type: ExerciseType,
  reverse = false,
): Question {
  const answer = reverse ? word.term : word.translation;
  const others = shuffled(
    [
      ...new Set(
        words
          .filter((w) => w.id !== word.id)
          .map((w) => (reverse ? w.term : w.translation)),
      ),
    ].filter((v) => v !== answer),
  );
  const options = shuffled([answer, ...others.slice(0, 3)]);
  if (type === "choice" && options.length < 2) type = "typing";
  if (
    type === "cloze" &&
    (!word.example ||
      !word.example.toLowerCase().includes(word.term.toLowerCase()))
  )
    type = "typing";
  const candidate = Math.random() > 0.5 || !others.length ? answer : others[0];
  return {
    word,
    type,
    reverse,
    prompt:
      type === "cloze"
        ? word.example.replace(
            new RegExp(word.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
            "______",
          )
        : reverse
          ? word.translation
          : word.term,
    answer:
      type === "cloze" || type === "listening"
        ? word.term
        : type === "boolean"
          ? candidate === answer
            ? "Верно"
            : "Неверно"
          : answer,
    options: type === "boolean" ? ["Верно", "Неверно"] : options,
    candidate,
  };
}
export function isCorrect(answer: string, expected: string) {
  const clean = (s: string) =>
    normalize(s)
      .replace(/[.,!?;:]/g, "")
      .replace(/\s+/g, " ");
  return clean(answer) === clean(expected);
}
