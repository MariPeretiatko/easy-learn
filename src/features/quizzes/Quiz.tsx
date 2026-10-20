import { useRef, useState } from "react";
import { QuizResults } from "./QuizResults";
import { Volume2 } from "lucide-react";
import type { Word } from "../../types";
import { shuffled } from "../../utils/format";
import {
  createQuestion,
  exerciseNames,
  isCorrect,
  type ExerciseType,
  type Question,
} from "./engine";
import { Meter } from "../../components/UI";
import { speak } from "../../services/speech";
import { recordReview } from "../../services/review";
import { reportError } from "../../store/useUI";
import { useSettings } from "../../store/useSettings";
interface Answer {
  question: Question;
  answer: string;
  correct: boolean;
}
export function Quiz({
  words,
  mode,
  deckId,
}: {
  words: Word[];
  mode: "learn" | "test";
  deckId?: string;
}) {
  const [count, setCount] = useState(Math.min(10, words.length));
  const [types, setTypes] = useState<ExerciseType[]>(
    mode === "learn"
      ? ["choice", "typing", "listening", "cloze"]
      : ["choice", "typing"],
  );
  const [reverse, setReverse] = useState(
    useSettings.getState().settings.direction === "reverse",
  );
  const [difficult, setDifficult] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [feedback, setFeedback] = useState<Answer | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const retries = useRef<Record<string, number>>({});
  const eligible = words.filter((w) => !difficult || w.difficulty >= 4);
  function start(source = eligible) {
    const chosen = shuffled(source).slice(0, count);
    setQuestions(
      chosen.map((w, i) =>
        createQuestion(
          w,
          words,
          types[i % types.length],
          mode === "learn" ? i % 2 === 1 : reverse,
        ),
      ),
    );
    setIndex(0);
    setAnswers([]);
    setFeedback(null);
    setFinished(false);
    setAnswer("");
    retries.current = {};
    started.current = Date.now();
  }
  async function submit() {
    if (!answer.trim() || busy || feedback) return;
    setBusy(true);
    const question = questions[index];
    const correct = isCorrect(answer, question.answer);
    try {
      await recordReview(
        question.word,
        correct ? "good" : "again",
        Date.now() - started.current,
        deckId,
      );
      const result = { question, answer, correct };
      setAnswers((a) => [...a, result]);
      setFeedback(result);
      if (
        mode === "learn" &&
        !correct &&
        (retries.current[question.word.id] ?? 0) < 2
      ) {
        retries.current[question.word.id] =
          (retries.current[question.word.id] ?? 0) + 1;
        setQuestions((q) => [
          ...q,
          createQuestion(question.word, words, "typing", question.reverse),
        ]);
      }
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }
  function next() {
    if (index + 1 >= questions.length) setFinished(true);
    else {
      setIndex(index + 1);
      setFeedback(null);
      setAnswer("");
      started.current = Date.now();
    }
  }
  if (finished) return <QuizResults answers={answers} start={start} />;
  if (!questions.length)
    return (
      <section className="panel quiz-panel">
        <h2>
          {mode === "test"
            ? "Настройте свою проверку"
            : "Немного разной практики"}
        </h2>
        <p className="muted">
          {mode === "learn"
            ? "Выбирайте, пишите и слушайте. Слова с ошибками появятся снова."
            : "Соберите тест под свои цели."}
        </p>
        <label>
          Количество заданий
          <input
            type="number"
            min="1"
            max={Math.max(1, eligible.length)}
            value={count}
            onChange={(e) =>
              setCount(
                Math.max(1, Math.min(eligible.length, Number(e.target.value))),
              )
            }
          />
        </label>
        <label>
          Направление
          <select
            value={reverse ? "reverse" : "forward"}
            onChange={(e) => setReverse(e.target.value === "reverse")}
            disabled={mode === "learn"}
          >
            <option value="forward">Слово → перевод</option>
            <option value="reverse">Перевод → слово</option>
          </select>
        </label>
        <p className="hint">
          {mode === "learn"
            ? "В режиме «Учить» направления чередуются. На слух и пропуски — на изучаемом языке."
            : "Задания на слух и пропуски — на изучаемом языке."}
        </p>
        <h3>Виды заданий</h3>
        {Object.entries(exerciseNames).map(([id, title]) => (
          <label className="check-label" key={id}>
            <input
              type="checkbox"
              checked={types.includes(id as ExerciseType)}
              onChange={(e) =>
                setTypes(
                  e.target.checked
                    ? [...types, id as ExerciseType]
                    : types.filter((t) => t !== id),
                )
              }
            />
            {title}
          </label>
        ))}
        <label className="check-label">
          <input
            type="checkbox"
            checked={difficult}
            onChange={(e) => setDifficult(e.target.checked)}
          />
          Только сложные слова
        </label>
        <p className="hint">
          Доступно: {eligible.length} слов. Для пропусков нужен пример с самим
          словом.
        </p>
        <button
          className="button"
          disabled={!types.length || !eligible.length}
          onClick={() => start()}
        >
          Начать {mode === "test" ? "тест" : "практику"}
        </button>
      </section>
    );
  const q = questions[index];
  return (
    <section className="panel quiz-panel">
      <div className="session-bar">
        <span>{exerciseNames[q.type]}</span>
        <span>
          {index + 1} / {questions.length}
        </span>
      </div>
      <Meter value={index} total={questions.length} />
      {q.type === "listening" ? (
        <div className="center" style={{ padding: 40 }}>
          <button
            className="button"
            onClick={() => speak(q.word.term, q.word.language)}
          >
            <Volume2 size={22} />
            Послушать слово
          </button>
          <p className="hint">Запишите слово на изучаемом языке.</p>
        </div>
      ) : (
        <div className="quiz-prompt">
          {q.prompt}
          {q.type === "boolean" && (
            <>
              <br />
              <span className="muted">{q.candidate}</span>
            </>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (feedback) next();
          else void submit();
        }}
      >
        {q.type === "choice" || q.type === "boolean" ? (
          <div className="choice-grid">
            {q.options.map((option) => (
              <button
                type="button"
                disabled={!!feedback}
                key={option}
                className={`choice ${answer === option ? "selected" : ""} ${feedback ? (option === q.answer ? "correct" : answer === option ? "wrong" : "") : ""}`}
                onClick={() => setAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <label>
            Ваш ответ
            <input
              autoComplete="off"
              autoFocus
              key={index}
              disabled={!!feedback}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Введите ответ…"
            />
          </label>
        )}
        {feedback && (
          <div
            className={`answer-feedback ${feedback.correct ? "" : "incorrect"}`}
          >
            {feedback.correct
              ? "Верно. Отличная работа!"
              : `Правильный ответ: ${q.answer}`}
            <br />
            {q.word.example}
          </div>
        )}
        <div className="modal-actions">
          <button className="button" disabled={busy || !answer.trim()}>
            {busy
              ? "Сохраняем…"
              : feedback
                ? index + 1 === questions.length
                  ? "Результаты"
                  : "Дальше"
                : "Проверить"}
          </button>
        </div>
      </form>
    </section>
  );
}
