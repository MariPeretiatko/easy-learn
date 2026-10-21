import { AutoTextarea } from "../../components/AutoTextarea";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw, Volume2 } from "lucide-react";
import type { Subtitle } from "../../types";
import type { useYouTube } from "./useYouTube";
import { compareDictation } from "./dictation";
import { timeLabel } from "../../utils/format";
type Controller = ReturnType<typeof useYouTube>;
export function Listening({
  subtitles,
  yt,
}: {
  subtitles: Subtitle[];
  yt: Controller;
}) {
  const [index, setIndex] = useState(0);
  const [show, setShow] = useState(false);
  const [translation, setTranslation] = useState(false);
  const [dictation, setDictation] = useState("");
  const [checked, setChecked] = useState(false);
  const [repeats, setRepeats] = useState(1);
  const [autoPause, setAutoPause] = useState(true);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [looping, setLooping] = useState(false);
  const running = useRef<{
    start: number;
    end: number;
    remaining: number;
  } | null>(null);
  const seekPending = useRef(false);
  const sentence =
    subtitles[Math.min(index, Math.max(0, subtitles.length - 1))];
  useEffect(() => {
    const loop = running.current;
    if (!loop || yt.state !== 1) return;
    if (seekPending.current) {
      if (yt.time < loop.end - 0.2) seekPending.current = false;
      return;
    }
    if (yt.time >= loop.end - 0.06) {
      if (loop.remaining > 1) {
        loop.remaining--;
        seekPending.current = true;
        yt.seek(loop.start);
      } else {
        running.current = null;
        setLooping(false);
        if (autoPause) yt.pause();
      }
    }
  }, [yt.time, yt.state, autoPause, yt]);
  useEffect(
    () => () => {
      running.current = null;
    },
    [],
  );
  function replay(useAB = false) {
    const start = useAB ? a : sentence?.start;
    const end = useAB ? b : sentence?.end;
    if (start == null || end == null || end <= start) return;
    running.current = { start, end, remaining: repeats };
    seekPending.current = true;
    setLooping(true);
    yt.seek(start);
    yt.play();
  }
  function next() {
    yt.pause();
    running.current = null;
    setLooping(false);
    setIndex((i) => Math.min(subtitles.length - 1, i + 1));
    setShow(false);
    setTranslation(false);
    setDictation("");
    setChecked(false);
  }
  const result =
    checked && sentence ? compareDictation(sentence.text, dictation) : null;
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Сначала услышать</h2>
        <span className="hint">
          Фраза {index + 1} / {subtitles.length}
        </span>
      </div>
      <p className="hint">
        Слушайте без подсказок. При необходимости откройте оригинал или перевод.
      </p>
      <div className="listening-tools">
        <button
          className="button"
          disabled={!sentence || !yt.ready}
          onClick={() => replay()}
        >
          <Volume2 size={17} />
          {looping ? "Начать заново" : "Слушать фразу"}
        </button>
        <button className="button secondary" onClick={() => setShow(!show)}>
          {show ? "Скрыть" : "Показать"} оригинал
        </button>
        <button
          className="button secondary"
          onClick={() => setTranslation(!translation)}
        >
          Перевод
        </button>
        <button
          className="button secondary"
          disabled={index >= subtitles.length - 1}
          onClick={next}
        >
          Следующая <ArrowRight size={16} />
        </button>
      </div>
      {show && <p className="listening-sentence">{sentence?.text}</p>}
      {translation && (
        <p className="muted">
          {sentence?.translation ||
            "Перевод этой строки не добавлен. Его можно указать в редакторе субтитров."}
        </p>
      )}
      <div className="listening-tools">
        <label>
          Повторить
          <select
            value={repeats}
            onChange={(e) => setRepeats(Number(e.target.value))}
          >
            {[1, 3, 5].map((n) => (
              <option key={n} value={n}>
                {n} раз
              </option>
            ))}
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={autoPause}
            onChange={(e) => setAutoPause(e.target.checked)}
          />
          Пауза после фразы
        </label>
        {looping && (
          <button
            className="button secondary"
            onClick={() => {
              running.current = null;
              setLooping(false);
              yt.pause();
            }}
          >
            Остановить повтор
          </button>
        )}
      </div>
      <details>
        <summary>Повтор от A до B</summary>
        <div className="listening-tools">
          <button className="button secondary" onClick={() => setA(yt.time)}>
            A: {a == null ? "поставить" : timeLabel(a)}
          </button>
          <button className="button secondary" onClick={() => setB(yt.time)}>
            B: {b == null ? "поставить" : timeLabel(b)}
          </button>
          <button
            className="button secondary"
            disabled={a == null || b == null || b <= a || !yt.ready}
            onClick={() => replay(true)}
          >
            <RotateCcw size={15} />
            Повторить A–B
          </button>
        </div>
      </details>
      <hr />
      <h3>Диктант</h3>
      <label>
        Что вы услышали?
        <AutoTextarea
          value={dictation}
          onChange={(e) => {
            setDictation(e.target.value);
            setChecked(false);
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (dictation.trim() && sentence) setChecked(true);
            }
          }}
          enterKeyHint="done"
          className={
            checked
              ? result?.accuracy === 100
                ? "dictation-correct"
                : "dictation-wrong"
              : undefined
          }
          placeholder="Запишите фразу на изучаемом языке…"
        />
      </label>
      <p className="hint">Нажмите Enter или «Готово» на клавиатуре.</p>
      {result && (
        <>
          <p className="hint">
            Точность: {result.accuracy}% · Зелёный: верно · Жёлтый: пропущено ·
            Красный: лишнее или неверное
          </p>
          <div className="dictation-result">
            {result.tokens.map((token, i) => (
              <span key={i} className={token.status}>
                {token.text}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
