import type { Question } from "./engine";
export interface Answer {
  question: Question;
  answer: string;
  correct: boolean;
  incorrectWordIds?: string[];
}

export type QuizMode = "learn" | "test";
export type AnswerDirection = "learning" | "native" | "both";

export type AnswerHandler = (
  value: string,
  correct?: boolean,
  incorrectWordIds?: string[],
) => void;
