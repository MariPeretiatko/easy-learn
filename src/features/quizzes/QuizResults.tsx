import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import type { Word } from "../../types";
import type { Question } from "./engine";
export function QuizResults({
  answers,
  start,
}: {
  answers: { question: Question; answer: string; correct: boolean }[];
  start: (source?: Word[]) => void;
}) {
  const correct = answers.filter((a) => a.correct).length;
  const mistakes = answers.filter((a) => !a.correct);
  const mistakeWords = [
    ...new Map(
      mistakes.map((a) => [a.question.word.id, a.question.word]),
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
