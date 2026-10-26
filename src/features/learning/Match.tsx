import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import type { Word } from "../../types";
import { shuffled } from "../../utils/format";
import { useSettings } from "../../store/useSettings";
import { trackActivity } from "../../services/repositories";
import { perform } from "../../store/useUI";
interface Tile {
  id: string;
  wordId: string;
  side: "word" | "translation";
  label: string;
}
export function Match({ words, deckId }: { words: Word[]; deckId?: string }) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [errors, setErrors] = useState(0);
  const started = useRef(0);
  const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { settings, update } = useSettings();
  const bestKey = deckId ?? settings.learningLanguage;
  const complete = tiles.length > 0 && matched.length === tiles.length / 2;
  useEffect(() => {
    if (!tiles.length || complete) return;
    const timer = setInterval(
      () => setSeconds((Date.now() - started.current) / 1000),
      100,
    );
    return () => clearInterval(timer);
  }, [tiles, complete]);
  useEffect(() => () => clearTimeout(delay.current), []);
  function start() {
    const terms = new Set<string>(),
      translations = new Set<string>();
    const selected = shuffled(words)
      .filter((word) => {
        const term = word.term.normalize("NFC").trim().toLocaleLowerCase();
        const translation = word.translation
          .normalize("NFC")
          .trim()
          .toLocaleLowerCase();
        if (terms.has(term) || translations.has(translation)) return false;
        terms.add(term);
        translations.add(translation);
        return true;
      })
      .slice(0, 6);
    setTiles(
      shuffled(
        selected.flatMap((w) => [
          {
            id: `${w.id}-word`,
            wordId: w.id,
            side: "word" as const,
            label: w.term,
          },
          {
            id: `${w.id}-translation`,
            wordId: w.id,
            side: "translation" as const,
            label: w.translation,
          },
        ]),
      ),
    );
    setSelected(null);
    setMatched([]);
    setErrors(0);
    setSeconds(0);
    setWrong([]);
    started.current = Date.now();
  }
  function choose(tile: Tile) {
    if (wrong.length || tile.id === selected?.id) return;
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.wordId === tile.wordId && selected.side !== tile.side) {
      const next = [...matched, tile.wordId];
      setMatched(next);
      setSelected(null);
      if (next.length === tiles.length / 2) {
        const elapsed = (Date.now() - started.current) / 1000;
        setSeconds(elapsed);
        const best = settings.matchBest[bestKey];
        if (!best || elapsed < best)
          update({ matchBest: { ...settings.matchBest, [bestKey]: elapsed } });
        void perform(() => trackActivity({ studyMinutes: elapsed / 60 }));
      }
    } else {
      setWrong([selected.id, tile.id]);
      setErrors((e) => e + 1);
      delay.current = setTimeout(() => {
        setWrong([]);
        setSelected(null);
      }, 650);
    }
  }
  if (!tiles.length)
    return (
      <section className="panel quiz-panel center">
        <h2>Найдите каждую пару</h2>
        <p className="muted">
          Соедините слово с его переводом. До шести пар за раунд.
        </p>
        {settings.matchBest[bestKey] && (
          <p className="hint">
            Ваш рекорд: {settings.matchBest[bestKey].toFixed(1)} с
          </p>
        )}
        <button className="button" onClick={start}>
          Начать игру
        </button>
      </section>
    );
  if (complete)
    return (
      <section className="panel session-complete">
        <Trophy size={45} />
        <h2>Все пары найдены!</h2>
        <p>
          {seconds.toFixed(1)} с · Ошибок: {errors}
        </p>
        <p>Рекорд: {settings.matchBest[bestKey]?.toFixed(1)} с</p>
        <button className="button" onClick={start}>
          Сыграть ещё
        </button>
      </section>
    );
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{seconds.toFixed(1)} с</h2>
        <span className="hint">
          {matched.length} / {tiles.length / 2} пар · Ошибок: {errors}
        </span>
      </div>
      <div className="match-grid">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            disabled={matched.includes(tile.wordId)}
            className={`match-tile ${selected?.id === tile.id ? "selected" : ""} ${matched.includes(tile.wordId) ? "matched" : ""} ${wrong.includes(tile.id) ? "wrong" : ""}`}
            onClick={() => choose(tile)}
          >
            {tile.label}
          </button>
        ))}
      </div>
    </section>
  );
}
