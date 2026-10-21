import type { SetCard } from "../../types";
import { uid } from "../../utils/format";
import { parseCSV } from "../../services/csv";
export const blankCard = (): SetCard => ({
  id: uid(),
  term: "",
  definition: "",
});
export function parseCardImport(importText: string, delimiter: string) {
  if (!importText.trim()) return { cards: [] as SetCard[], error: "" };
  try {
    const rows =
      delimiter === "auto"
        ? parseCSV(importText)
        : importText
            .trim()
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line, index) => {
              const separator = delimiter === "tab" ? "\t" : delimiter;
              const pos = line.indexOf(separator);
              if (
                pos < 0 ||
                !line.slice(0, pos).trim() ||
                !line.slice(pos + separator.length).trim()
              )
                throw new Error(
                  `Строка ${index + 1}: разделите термин и определение`,
                );
              return {
                term: line.slice(0, pos).trim(),
                translation: line.slice(pos + separator.length).trim(),
              };
            });
    return {
      cards: rows.map((row) => ({
        id: uid(),
        term: row.term,
        definition: row.translation,
      })),
      error: "",
    };
  } catch (e) {
    return {
      cards: [] as SetCard[],
      error: e instanceof Error ? e.message : "Проверьте данные",
    };
  }
}

export function swapCardSides(card: SetCard): SetCard {
  return {
    ...card,
    term: card.definition,
    definition: card.term,
    image: card.termImage,
    termImage: card.image,
    acceptedTerms: card.acceptedTranslations,
    acceptedTranslations: card.acceptedTerms,
  };
}
