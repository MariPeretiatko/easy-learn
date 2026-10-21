import { AutoTextarea } from "./AutoTextarea";
import type { Word } from "../types";
type Alternatives = Pick<Word, "acceptedTerms" | "acceptedTranslations">;
export function AnswerAlternatives({
  value,
  onChange,
  number,
  className,
}: {
  value: Alternatives;
  onChange: (patch: Alternatives) => void;
  number?: number;
  className?: string;
}) {
  return (
    <details className={className}>
      <summary>Допустимые ответы</summary>
      <p className="hint">
        По одному варианту на строке. Основной ответ тоже принимается. Запятые
        не разделяют варианты.
      </p>
      <div className="form-grid">
        {(
          [
            ["acceptedTerms", "Другие варианты термина"],
            ["acceptedTranslations", "Другие варианты перевода"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <AutoTextarea
              aria-label={number ? `${label} ${number}` : label}
              value={(value[key] ?? []).join("\n")}
              onChange={(event) =>
                onChange({ [key]: event.target.value.split("\n") })
              }
              rows={2}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
