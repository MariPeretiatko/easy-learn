import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Pencil,
  Play,
  Shuffle,
  Star,
  Volume2,
  Maximize2,
  Settings,
  Lightbulb,
} from "lucide-react";
import { useSettings } from "../../store/useSettings";
import { useSwipeNavigation } from "../../hooks/useSwipeNavigation";
import { speak } from "../../services/speech";
import { perform, reportError } from "../../store/useUI";
import { WordRepository } from "../../services/repositories";
import { shuffled } from "../../utils/format";
import { Modal } from "../../components/UI";
import type { Word } from "../../types";
export function SetPreview({
  allWords,
  deckId,
  starred,
  onStarredChange,
  edit,
}: {
  allWords: Word[];
  deckId: string;
  starred: boolean;
  onStarredChange: (value: boolean) => void;
  edit: () => void;
}) {
  const { settings, update } = useSettings();
  const reverse = settings.direction === "reverse";
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [auto, setAuto] = useState(false);
  const [hint, setHint] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [deckId, starred, order]);
  const cards = (
    order
      ? order.flatMap((id) => {
          const w = allWords.find((w) => w.id === id);
          return w ? [w] : [];
        })
      : allWords
  ).filter((w) => !starred || w.favorite);
  const word = cards[index % Math.max(1, cards.length)];
  useEffect(() => {
    setFlipped(false);
    setHint(false);
    if (settings.autoPronounce && word)
      speak(
        reverse ? word.translation : word.term,
        reverse ? word.nativeLanguage : word.language,
      );
  }, [word?.id, reverse, settings.autoPronounce]);
  useEffect(() => {
    if (tracking && flipped && word)
      setSeen((previous) =>
        previous.includes(word.id) ? previous : [...previous, word.id],
      );
  }, [tracking, flipped, word?.id]);
  useEffect(() => {
    if (!auto || !cards.length) return;
    const timer = setInterval(() => {
      if (flipped) {
        setIndex((i) => (i + 1) % cards.length);
        setFlipped(false);
      } else setFlipped(true);
    }, 2500);
    return () => clearInterval(timer);
  }, [auto, flipped, cards.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,dialog,aside,header",
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (e.key === "ArrowRight")
        setIndex((i) => (i + 1) % Math.max(1, cards.length));
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + cards.length) % Math.max(1, cards.length));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cards.length]);
  const swipe = useSwipeNavigation(
    () => setIndex((value) => Math.max(0, value - 1)),
    () => setIndex((value) => (value + 1) % Math.max(1, cards.length)),
  );
  return (
    <>
      <div className="set-study-stage">
        <div className="set-preview" ref={previewRef}>
          {word ? (
            <>
              <div className="set-preview-top">
                <button
                  className="set-hint-toggle"
                  aria-label="Показать подсказку"
                  aria-expanded={hint}
                  onClick={() => setHint((value) => !value)}
                >
                  <Lightbulb size={18} />
                  <span>{hint ? "Скрыть подсказку" : "Подсказка"}</span>
                </button>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Изменить карточки"
                    onClick={edit}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Произнести карточку"
                    onClick={() =>
                      speak(
                        flipped
                          ? reverse
                            ? word.term
                            : word.translation
                          : reverse
                            ? word.translation
                            : word.term,
                        flipped
                          ? reverse
                            ? word.language
                            : word.nativeLanguage
                          : reverse
                            ? word.nativeLanguage
                            : word.language,
                      )
                    }
                  >
                    <Volume2 size={20} />
                  </button>
                  <button
                    className={`icon-button ${word.favorite ? "active" : ""}`}
                    aria-label="Отметить карточку"
                    aria-pressed={word.favorite}
                    onClick={() =>
                      void perform(() =>
                        WordRepository.patch(word.id, {
                          favorite: !word.favorite,
                        }),
                      )
                    }
                  >
                    <Star
                      size={20}
                      fill={word.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              </div>
              {hint && (
                <div className="set-hint-content">
                  {word.example ||
                    `${(reverse ? word.term : word.translation).slice(0, 2)}…`}
                </div>
              )}
              <button
                {...swipe}
                className={`set-flip-target ${flipped ? "flipped" : ""}`}
                aria-label="Перевернуть карточку"
                onClick={() => setFlipped((v) => !v)}
              >
                <strong
                  className={`${!flipped && word.bold ? "is-bold " : ""}${!flipped && word.italic ? "is-italic " : ""}${!flipped && word.underline ? "is-underlined " : ""}${!flipped && word.highlight ? "is-highlighted" : ""}`}
                >
                  {flipped
                    ? reverse
                      ? word.term
                      : word.translation
                    : reverse
                      ? word.translation
                      : word.term}
                </strong>
              </button>
            </>
          ) : (
            <div className="set-preview-empty">
              <Star size={33} />
              <p>
                {starred
                  ? "Отметьте карточки звёздочкой, чтобы учить только их."
                  : "В этой колоде пока нет карточек."}
              </p>
            </div>
          )}
        </div>
        <div className="set-preview-controls">
          <label className="preview-tracking">
            <span>
              {tracking
                ? `Прогресс: ${seen.length} / ${cards.length}`
                : "Отслеживать прогресс"}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={tracking}
              onChange={(event) => setTracking(event.target.checked)}
            />
          </label>
          <div className="set-preview-paging">
            <button
              className="icon-button"
              aria-label="Предыдущая карточка"
              disabled={!index || !cards.length}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={20} />
            </button>
            <span>
              {cards.length ? (index % cards.length) + 1 : 0} / {cards.length}
            </span>
            <button
              className="icon-button"
              aria-label="Следующая карточка"
              disabled={!cards.length}
              onClick={() => setIndex((i) => (i + 1) % cards.length)}
            >
              <ArrowRight size={20} />
            </button>
          </div>
          <div className="set-playback-controls">
            <button
              className="icon-button"
              aria-label={
                auto ? "Приостановить карточки" : "Автопрокрутка карточек"
              }
              onClick={() => setAuto((v) => !v)}
            >
              {auto ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              className="icon-button"
              aria-label="Перемешать карточки"
              onClick={() =>
                setOrder(order ? null : shuffled(allWords.map((w) => w.id)))
              }
            >
              <Shuffle size={20} />
            </button>

            <button
              className="icon-button"
              aria-label="Настройки карточек"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Полный экран"
              onClick={() => {
                if (document.fullscreenElement)
                  void document.exitFullscreen().catch(reportError);
                else
                  void previewRef.current
                    ?.requestFullscreen()
                    .catch(reportError);
              }}
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>
      </div>
      {settingsOpen && (
        <Modal
          title="Настройки карточек"
          onClose={() => setSettingsOpen(false)}
        >
          <label>
            Сначала показывать
            <select
              value={settings.direction}
              onChange={(e) =>
                update({
                  direction: e.target.value as typeof settings.direction,
                })
              }
            >
              <option value="forward">Термин</option>
              <option value="reverse">Определение</option>
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.autoPronounce}
              onChange={(e) => update({ autoPronounce: e.target.checked })}
            />
            Автоматическое произношение
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={starred}
              onChange={(e) => onStarredChange(e.target.checked)}
            />
            Учить только отмеченные карточки
          </label>
          <div className="modal-actions">
            <button className="button" onClick={() => setSettingsOpen(false)}>
              Готово
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
