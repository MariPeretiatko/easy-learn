import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Volume2,
  Shuffle,
  RotateCcw,
  Maximize2,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Rating, Word } from "../../types";
import { useSettings } from "../../store/useSettings";
import { reportError } from "../../store/useUI";
import { speak } from "../../services/speech";
import { recordReview } from "../../services/review";
import { shuffled } from "../../utils/format";
import { Meter } from "../../components/UI";
const ratings: [Rating, string, string][] = [
  ["again", "Снова", "1"],
  ["hard", "Трудно", "2"],
  ["good", "Хорошо", "3"],
  ["easy", "Легко", "4"],
];
export function Flashcards({
  words,
  deckId,
}: {
  words: Word[];
  deckId?: string;
}) {
  const [queue, setQueue] = useState(() => [...words]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const { settings, update } = useSettings();
  const started = useRef(Date.now());
  const cardRef = useRef<HTMLDivElement>(null);
  const word = queue[index];
  const reverse = settings.direction === "reverse";
  useEffect(() => {
    setFlipped(false);
    started.current = Date.now();
    if (settings.autoPronounce && word)
      speak(
        reverse ? word.translation : word.term,
        reverse ? word.nativeLanguage : word.language,
      );
    return () => window.speechSynthesis?.cancel();
  }, [word?.id, settings.autoPronounce, reverse]);
  const next = () => {
    if (index + 1 >= queue.length) setDone(true);
    else setIndex(index + 1);
  };
  async function rate(rating: Rating) {
    if (busy || !flipped || reviewed.includes(word.id)) return;
    setBusy(true);
    try {
      await recordReview(word, rating, Date.now() - started.current, deckId);
      setReviewed((ids) => [...ids, word.id]);
      next();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        busy ||
        (e.target as HTMLElement).closest("input,textarea,select,dialog")
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
      const rating = ratings[Number(e.key) - 1];
      if (rating && flipped) void rate(rating[0]);
    };
    if (!done) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const restart = () => {
    setIndex(0);
    setReviewed([]);
    setDone(false);
    setFlipped(false);
    started.current = Date.now();
  };
  if (done)
    return (
      <section className="session-complete panel">
        <CheckCircle2 size={45} />
        <h2>Ещё один шаг сделан.</h2>
        <p>
          Повторено слов: {reviewed.length} из {queue.length}.
        </p>
        <div className="inline-actions">
          <button className="button" onClick={restart}>
            Повторить ещё раз
          </button>
          <Link className="button secondary" to="/progress">
            Мой прогресс
          </Link>
        </div>
      </section>
    );
  return (
    <div ref={cardRef} className="flashcard-workspace">
      <div className="session-bar">
        <span>
          КАРТОЧКА {index + 1} / {queue.length}
        </span>
        <div className="row-actions">
          <button
            className="icon-button"
            title="Перемешать"
            onClick={() => {
              setQueue(shuffled(queue));
              restart();
            }}
          >
            <Shuffle size={17} />
          </button>
          <button
            className="icon-button"
            title="Начать сначала"
            onClick={restart}
          >
            <RotateCcw size={17} />
          </button>
          <button
            className="icon-button"
            title="Полный экран"
            onClick={() => {
              if (document.fullscreenElement)
                void document.exitFullscreen().catch(reportError);
              else void cardRef.current?.requestFullscreen().catch(reportError);
            }}
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>
      <Meter value={index} total={queue.length} />
      <button
        className={`flashcard ${flipped ? "flipped" : ""}`}
        onClick={() => setFlipped(!flipped)}
        aria-label="Перевернуть карточку"
      >
        <span className="eyebrow">
          {flipped ? "ОБРАТНАЯ СТОРОНА" : "ВСПОМНИТЕ ПЕРЕВОД"}
        </span>
        <strong>
          {flipped
            ? reverse
              ? word.term
              : word.translation
            : reverse
              ? word.translation
              : word.term}
        </strong>
        {flipped && word.example && <p>{word.example}</p>}
        {flipped && (
          <small>
            {[
              word.ipa,
              word.partOfSpeech,
              word.gender,
              word.plural,
              word.definition,
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
        )}
        <span className="flip-hint">Нажмите на карточку или пробел</span>
      </button>
      <div className="flashcard-navigation">
        <button
          className="icon-button"
          aria-label="Предыдущая карточка"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          className="button secondary"
          onClick={() => speak(word.term, word.language)}
        >
          <Volume2 size={17} />
          Произнести
        </button>
        <button
          className="icon-button"
          aria-label="Следующая карточка"
          onClick={next}
        >
          <ArrowRight size={20} />
        </button>
      </div>
      <div className="rating-grid">
        {ratings.map(([value, label, key]) => (
          <button
            key={value}
            className={`rating ${value}`}
            disabled={!flipped || busy || reviewed.includes(word.id)}
            onClick={() => void rate(value)}
          >
            <span>{label}</span>
            <kbd>{key}</kbd>
          </button>
        ))}
      </div>
      <p className="hint center">
        {reviewed.includes(word.id)
          ? "Эта карточка уже оценена в текущем сеансе."
          : flipped
            ? "Насколько легко удалось вспомнить?"
            : "Сначала откройте перевод, затем оцените ответ."}
      </p>
      <label className="check-label center">
        <input
          type="checkbox"
          checked={settings.autoPronounce}
          onChange={(e) => update({ autoPronounce: e.target.checked })}
        />
        Автоматически произносить слово
      </label>
    </div>
  );
}
