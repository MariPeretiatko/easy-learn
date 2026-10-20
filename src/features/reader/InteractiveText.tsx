import { useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { lemma } from "../../services/translation";
import { normalize } from "../../utils/format";
import type { Language } from "../../types";
export function tokenize(content: string) {
  return content.split(/([\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*)/gu);
}
export function InteractiveText({
  content,
  language,
  onSelect,
  style,
}: {
  content: string;
  language: Language;
  onSelect: (text: string) => void;
  style?: CSSProperties;
}) {
  const words =
    useLiveQuery(
      () => db.words.where("language").equals(language).toArray(),
      [language],
    ) ?? [];
  const [selection, setSelection] = useState("");
  const lookup = new Map(
    words.flatMap((w) => [
      [normalize(w.term), w],
      [normalize(w.term.replace(/^(der|die|das)\s+/i, "")), w],
    ]),
  );
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
          const word = lookup.get(normalize(lemma(token, language)));
          return (
            <button
              key={i}
              className={`text-word ${word?.status ?? "unknown"}`}
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
