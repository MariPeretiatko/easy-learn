import { db } from "../../db/database";
import { recordReviews } from "../../services/review";
import { uid } from "../../utils/format";
import { assessmentsFor } from "./assessments";
import type { Answer } from "./types";
/** Reviews and the visible test result must either both be saved or both roll back. */
export async function saveTestAttempt(
  answers: Answer[],
  elapsed: number,
  title: string,
  deckId?: string,
) {
  const id = uid();
  await db.transaction(
    "rw",
    [
      db.words,
      db.reviews,
      db.statistics,
      db.decks,
      db.testResults,
      ...(db.owner ? [db.activity] : []),
    ],
    async () => {
      await recordReviews(answers.flatMap(assessmentsFor), elapsed, deckId);
      await db.testResults.add({
        id,
        deckId,
        title,
        timestamp: Date.now(),
        answers: answers.map((answer) => ({
          term: answer.question.word.term,
          expected: answer.question.answer,
          given: answer.answer,
          correct: answer.correct,
        })),
      });
    },
  );
  return id;
}
