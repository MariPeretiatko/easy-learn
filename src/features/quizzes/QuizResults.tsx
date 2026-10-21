import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import type { Word } from "../../types";
import type { Answer } from "./types";
export function QuizResults({
  answers,
  start,
  resultId,
  learningSummary,
}: {
  answers: Answer[];
  learningSummary?: { mastered: number; total: number };
  start: (source?: Word[]) => void;
  resultId?: string;
}) {
  const correct = answers.filter((a) => a.correct).length;
  const mistakes = answers.filter((a) => !a.correct);
  const mistakeWords = [
    ...new Map(
      mistakes.flatMap((a) =>
        (
          a.question.pairs?.filter(
            (word) =>
              !a.incorrectWordIds || a.incorrectWordIds.includes(word.id),
          ) ?? [a.question.word]
        ).map((word) => [word.id, word] as const),
      ),
    ).values(),
  ];
  return (
    <section className="panel session-complete">
      <Trophy size={45} />
      <span className="eyebrow">ПРАКТИКА ЗАВЕРШЕНА</span>
      <h2>
        {Math.round((correct / Math.max(1, answers.length)) * 100)}% правильных
        ответов
      </h2>
      {learningSummary && (
        <p className="learning-summary">
          Закреплено карточек: {learningSummary.mastered} из{" "}
          {learningSummary.total}. Точность учитывает все попытки занятия.
        </p>
      )}
      <p>
        {correct} правильно · {mistakes.length} ошибок · {answers.length}{" "}
        заданий
      </p>
      {mistakes.length > 0 && (
        <div className="result-list">
          {mistakes.map((a, i) => (
            <div key={i}>
              <span>
                <strong>{a.question.word.term}</strong>
                <small>Ваш ответ: {a.answer}</small>
              </span>
              <span>{a.question.answer}</span>
            </div>
          ))}
        </div>
      )}
      <div className="inline-actions">
        {resultId && (
          <Link className="button secondary" to={`/results/${resultId}`}>
            Сохранённый результат
          </Link>
        )}
        {mistakeWords.length > 0 && (
          <button className="button" onClick={() => start(mistakeWords)}>
            Повторить ошибки
          </button>
        )}
        <button className="button secondary" onClick={() => start()}>
          Ещё раз
        </button>
        <Link to="/progress" className="button secondary">
          Мой прогресс
        </Link>
      </div>
    </section>
  );
}
