import { useEffect, useRef, useState } from "react";
import { Trophy, Zap, Heart, Timer } from "lucide-react";
import { Word } from "../../types";
import { shuffled } from "../../utils/format";
import { createQuestion, isAnswerCorrect, Question } from "../quizzes/engine";
import { recordReview } from "../../services/review";
import { reportError } from "../../store/useUI";
import { useSettings } from "../../store/useSettings";
export function Arcade({ words, deckId }: { words: Word[]; deckId?: string }) {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const started = useRef(0);
  const currentStarted = useRef(0);
  const { settings, update } = useSettings();
  const bestKey = `blast-${deckId ?? settings.learningLanguage}`;
  useEffect(() => () => clearTimeout(timeout.current), []);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        60 - Math.floor((Date.now() - started.current) / 1000),
      );
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setFinished(true);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (finished && score > (settings.matchBest[bestKey] ?? 0))
      update({ matchBest: { ...settings.matchBest, [bestKey]: score } });
  }, [finished, score, bestKey, settings.matchBest, update]);
  const next = () => {
    currentStarted.current = Date.now();
    setQuestion(createQuestion(shuffled(words)[0], words, "choice"));
    setFeedback(null);
    setSelectedAnswer("");
  };
  const start = () => {
    setScore(0);
    setLives(3);
    setFinished(false);
    setRunning(true);
    setRemaining(60);
    started.current = Date.now();
    next();
  };
  async function answer(value: string) {
    if (!question || submitting.current || feedback || !running) return;
    submitting.current = true;
    setSelectedAnswer(value);
    setBusy(true);
    const correct = isAnswerCorrect(value, question, settings);
    try {
      await recordReview(
        question.word,
        correct ? "good" : "again",
        Date.now() - currentStarted.current,
        deckId,
      );
      setFeedback(
        correct
          ? "Верно! +100"
          : question.type === "typing"
            ? `Правильный ответ: ${question.answer}`
            : "Попробуйте следующий термин",
      );
      if (correct) setScore((s) => s + 100);
      else setLives((s) => s - 1);
      timeout.current = setTimeout(() => {
        if (!correct && lives === 1) {
          setRunning(false);
          setFinished(true);
        } else next();
        setBusy(false);
        submitting.current = false;
      }, 650);
    } catch (e) {
      reportError(e);
      setBusy(false);
      submitting.current = false;
      setSelectedAnswer("");
    }
  }
  if (finished)
    return (
      <section className="panel session-complete">
        <Trophy size={55} />
        <h1>{score} очков</h1>
        <p>
          Ваш рекорд: {Math.max(score, settings.matchBest[bestKey] ?? 0)} очков
        </p>
        <button className="button" onClick={start}>
          Сыграть ещё
        </button>
      </section>
    );
  if (!running)
    return (
      <section className="panel arcade-intro">
        <Zap size={55} />
        <h2>Blast</h2>
        <p>
          60 секунд. Три жизни. Находите правильный перевод и набирайте очки.
        </p>
        <p className="muted">Рекорд: {settings.matchBest[bestKey] ?? 0}</p>
        <button className="button" onClick={start}>
          Начать игру
        </button>
      </section>
    );
  return (
    <div className="blast-game">
      <div className="blast-status">
        <span>
          <Timer size={21} />
          {remaining} с
        </span>
        <strong>{score} очков</strong>
        <span>
          <Heart size={21} />
          {lives}
        </span>
      </div>
      <div className="blast-orbit">
        <Zap size={28} />
        <h2>{question?.prompt}</h2>
      </div>
      <div className="blast-options">
        {question?.type === "choice" ? (
          question.options.map((option) => (
            <button
              disabled={busy || !running}
              key={option}
              className={
                feedback
                  ? option === question.answer
                    ? "correct"
                    : selectedAnswer === option
                      ? "wrong"
                      : ""
                  : ""
              }
              onClick={() => void answer(option)}
            >
              {option}
            </button>
          ))
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void answer(String(form.get("answer") ?? ""));
            }}
          >
            <input
              autoComplete="off"
              name="answer"
              className={
                feedback
                  ? feedback === "Верно! +100"
                    ? "correct"
                    : "wrong"
                  : ""
              }
              key={`${score}-${lives}`}
              disabled={busy}
              enterKeyHint="done"
              aria-label="Ответ в игре"
              required
            />
            <p className="hint">Нажмите Enter или «Готово» на клавиатуре.</p>
          </form>
        )}
      </div>
      {feedback && (
        <p className="blast-feedback" role="status">
          {feedback}
        </p>
      )}
    </div>
  );
}
