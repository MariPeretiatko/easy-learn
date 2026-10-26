import { useState, type CSSProperties } from "react";
import { lemma } from "../../services/translation";
import { normalize } from "../../utils/format";
import type { Language, Word, WordStatus } from "../../types";
export function tokenize(content: string) {
  return content.split(/([\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*)/gu);
}
export function wordStatusLookup(words: Word[]) {
  return new Map<string, WordStatus>(
    words.flatMap((word) => [
      [normalize(word.term), word.status],
      [normalize(word.term.replace(/^(der|die|das)\s+/i, "")), word.status],
    ]),
  );
}
export function InteractiveText({
  content,
  language,
  onSelect,
  style,
  vocabulary,
}: {
  content: string;
  language: Language;
  onSelect: (text: string) => void;
  style?: CSSProperties;
  vocabulary: ReadonlyMap<string, WordStatus>;
}) {
  const [selection, setSelection] = useState("");
  return (
    <div className="interactive-container">
      <div
        className="interactive-text"
        style={style}
        onMouseUp={() => {
          const selected = window.getSelection()?.toString().trim() ?? "";
          setSelection(
            selected.length > 1 && selected.length < 1000 ? selected : "",
          );
        }}
        onTouchEnd={() => {
          const selected = window.getSelection()?.toString().trim() ?? "";
          if (selected) setSelection(selected);
        }}
      >
        {tokenize(content).map((token, i) => {
          if (!/[\p{L}]/u.test(token)) return <span key={i}>{token}</span>;
          const status = vocabulary.get(normalize(lemma(token, language)));
          return (
            <button
              key={i}
              className={`text-word ${status ?? "unknown"}`}
              onClick={() => {
                if (!window.getSelection()?.toString().trim()) onSelect(token);
              }}
            >
              {token}
            </button>
          );
        })}
      </div>
      {selection && (
        <button
          className="selection-action button"
          onClick={() => {
            onSelect(selection);
            setSelection("");
            window.getSelection()?.removeAllRanges();
          }}
        >
          Разобрать выделенное
        </button>
      )}
    </div>
  );
}
