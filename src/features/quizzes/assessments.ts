import type { Answer } from "./types";
import type { ReviewAssessment } from "../../services/review";
export function assessmentsFor(answer: Answer): ReviewAssessment[] {
  return (answer.question.pairs ?? [answer.question.word]).map((word) => ({
    word,
    correct:
      answer.question.type === "matching" && answer.incorrectWordIds
        ? !answer.incorrectWordIds.includes(word.id)
        : answer.correct,
  }));
}
