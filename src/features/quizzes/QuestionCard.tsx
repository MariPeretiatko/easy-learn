import { MatchingAnswers } from "./MatchingAnswers";
import type { Answer, AnswerHandler } from "./types";
import { useState } from "react";
import { Check, X, Volume2 } from "lucide-react";
import { speak } from "../../services/speech";
import { exerciseNames, type Question } from "./engine";

export function QuestionCard({
  question: q,
  number,
  total,
  result,
  disabled,
  deferred = false,
  draft,
  adaptive = false,
  onAnswer,
}: {
  question: Question;
  number: number;
  total: number;
  result?: Answer;
  disabled: boolean;
  adaptive?: boolean;
  deferred?: boolean;
  draft?: Answer;
  onAnswer: AnswerHandler;
}) {
  const [text, setText] = useState("");
  const locked = disabled || !!result;
  return (
    <article
      id={`question-${number}`}
      className={`panel question-card ${result ? (result.correct ? "answer-correct" : "answer-wrong") : ""}`}
      aria-label={`Задание ${number}`}
    >
      <div className="question-card-heading">
        <span>{exerciseNames[q.type]}</span>
        <span>{adaptive ? `Попытка ${number}` : `${number} из ${total}`}</span>
      </div>
      {q.type === "listening" ? (
        <div className="quiz-listening-prompt">
          <button
            className="button secondary"
            onClick={() => speak(q.word.term, q.word.language)}
          >
            <Volume2 size={22} />
            Послушать слово
          </button>
        </div>
      ) : q.type === "matching" ? (
        <h2 className="quiz-prompt">Соедините слова с переводами</h2>
      ) : (
        <h2 className="quiz-prompt">
          {q.prompt}
          {q.type === "boolean" && (
            <span className="boolean-candidate">{q.candidate}</span>
          )}
        </h2>
      )}
      {q.type === "choice" || q.type === "boolean" ? (
        <div className="choice-grid">
          {q.options.map((option) => (
            <button
              type="button"
              key={option}
              disabled={locked}
              aria-pressed={(result ?? draft)?.answer === option}
              className={`choice ${deferred && draft?.answer === option ? "selected" : ""} ${result ? (option === q.answer ? "correct" : result.answer === option ? "wrong" : "") : ""}`}
              onClick={() => onAnswer(option)}
            >
              <span>{option}</span>
              {result && option === q.answer ? (
                <Check size={20} />
              ) : result?.answer === option ? (
                <X size={20} />
              ) : null}
            </button>
          ))}
        </div>
      ) : q.type === "matching" ? (
        <MatchingAnswers
          question={q}
          deferred={deferred}
          disabled={locked}
          onAnswer={onAnswer}
        />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked && text.trim()) onAnswer(text);
          }}
        >
          <label>
            Ваш ответ
            <input
              className={`quiz-written-answer ${result ? (result.correct ? "correct" : "wrong") : ""}`}
              aria-label={`Ваш ответ ${number}`}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing)
                  event.preventDefault();
              }}
              enterKeyHint="done"
              value={text}
              disabled={locked}
              onChange={(event) => {
                setText(event.target.value);
                if (deferred) onAnswer(event.target.value);
              }}
              placeholder={
                q.type === "listening"
                  ? "Запишите услышанное слово"
                  : "Введите ответ"
              }
            />
          </label>
          {!result && (
            <p className="question-input-hint">
              {deferred
                ? "Ответ можно изменить до проверки теста."
                : "Нажмите Enter или «Готово» на клавиатуре."}
            </p>
          )}
        </form>
      )}
      {result &&
        !result.correct &&
        (q.type === "typing" || q.type === "listening") && (
          <div className="correct-answer" role="status">
            <span>Правильный ответ</span>
            <strong>{q.answer}</strong>
          </div>
        )}
      {result && (
        <span className="sr-only" role="status">
          {result.correct ? "Верно" : "Неверно"}
        </span>
      )}
    </article>
  );
}
