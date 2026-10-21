import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  GripHorizontal,
  ImagePlus,
  Italic,
  Trash2,
  Underline,
  Highlighter,
  X,
} from "lucide-react";
import { AutoTextarea } from "../../components/AutoTextarea";
import { AnswerAlternatives } from "../../components/AnswerAlternatives";
import type { SetCard, Word } from "../../types";
import { readImage } from "../../services/media";
export function SetCardEditor({
  card,
  index,
  isLast,
  dragging,
  dictionary,
  suggestions,
  onPatch,
  onMove,
  onRemove,
  onDrop,
  onDragStart,
  onDragEnd,
  onError,
}: {
  card: SetCard;
  index: number;
  isLast: boolean;
  dragging: boolean;
  dictionary: Word[];
  suggestions: boolean;
  onPatch: (value: Partial<SetCard>) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
  onDrop: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onError: (message: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <article
      className={`editor-card ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div className="editor-card-bar">
        <span>{index + 1}</span>
        <div>
          <span
            draggable
            onDragStart={() => onDragStart()}
            onDragEnd={() => onDragEnd()}
            className="drag-grip"
            title="Перетащите карточку"
          >
            <GripHorizontal size={20} />
          </span>
          <button
            type="button"
            className="icon-button card-move"
            aria-label={`Поднять карточку ${index + 1}`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="icon-button card-move"
            aria-label={`Опустить карточку ${index + 1}`}
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Удалить карточку ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="editor-card-body">
        <CardImage
          value={card.termImage}
          label={`Изображение термина ${index + 1}`}
          removeLabel={`Удалить изображение термина ${index + 1}`}
          onChange={(termImage) => onPatch({ termImage })}
          onError={onError}
          side="term"
        />
        <div className="editor-term-field">
          <label>
            <AutoTextarea
              aria-label={`Термин ${index + 1}`}
              className={`${card.bold ? "is-bold " : ""}${card.italic ? "is-italic " : ""}${card.underline ? "is-underlined " : ""}${card.highlight ? "is-highlighted" : ""}`}
              value={card.term}
              onChange={(e) => onPatch({ term: e.target.value })}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={1}
            />
            <span>ТЕРМИН</span>
          </label>
          {suggestions &&
            focused &&
            card.term.trim().length > 1 &&
            dictionary.some(
              (w) =>
                w.term
                  .toLowerCase()
                  .startsWith(card.term.trim().toLowerCase()) &&
                w.term !== card.term,
            ) && (
              <div className="editor-suggestions">
                {dictionary
                  .filter(
                    (w) =>
                      w.term
                        .toLowerCase()
                        .startsWith(card.term.trim().toLowerCase()) &&
                      w.term !== card.term,
                  )
                  .slice(0, 4)
                  .map((word) => (
                    <button
                      type="button"
                      key={word.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPatch({
                          term: word.term,
                          definition: word.translation,
                        });
                        setFocused(false);
                      }}
                    >
                      <strong>{word.term}</strong>
                      <span>{word.translation}</span>
                    </button>
                  ))}
              </div>
            )}
        </div>
        <label className="editor-definition-field">
          <AutoTextarea
            aria-label={`Определение ${index + 1}`}
            value={card.definition}
            onChange={(e) => onPatch({ definition: e.target.value })}
            rows={1}
          />
          <span>ОПРЕДЕЛЕНИЕ</span>
        </label>
        <CardImage
          value={card.image}
          label={`Изображение ${index + 1}`}
          removeLabel={`Удалить изображение ${index + 1}`}
          onChange={(image) => onPatch({ image })}
          onError={onError}
          side="definition"
        />
      </div>
      <AnswerAlternatives
        className="card-accepted-answers"
        value={card}
        number={index + 1}
        onChange={onPatch}
      />
      <div className="editor-format">
        {(
          [
            ["bold", "Жирный", Bold],
            ["italic", "Курсив", Italic],
            ["underline", "Подчёркнутый", Underline],
            ["highlight", "Выделение", Highlighter],
          ] as const
        ).map(([key, title, Icon]) => (
          <button
            type="button"
            key={key}
            className={`icon-button ${card[key] ? "selected" : ""}`}
            aria-label={`${title} термин ${index + 1}`}
            aria-pressed={!!card[key]}
            onClick={() => onPatch({ [key]: !card[key] })}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    </article>
  );
}
function CardImage({
  value,
  label,
  removeLabel,
  onChange,
  onError,
  side,
}: {
  value?: string;
  label: string;
  removeLabel: string;
  onChange: (value: string | undefined) => void;
  onError: (message: string) => void;
  side: "term" | "definition";
}) {
  return (
    <div className={`editor-image editor-image-${side}`}>
      {value ? (
        <>
          <img src={value} alt={label} />
          <button
            type="button"
            className="icon-button"
            aria-label={removeLabel}
            onClick={() => onChange(undefined)}
          >
            <X size={15} />
          </button>
        </>
      ) : (
        <label>
          <ImagePlus size={22} />
          <span>Изображение</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            aria-label={label}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void readImage(file)
                  .then(onChange)
                  .catch((error) => onError(error.message));
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
