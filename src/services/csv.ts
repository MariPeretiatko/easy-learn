export interface CsvWord {
  term: string;
  translation: string;
  example?: string;
  tags?: string[];
}
function detectDelimiter(source: string) {
  // Count separators only outside quoted fields, across complete logical rows.
  const candidates = ["\t", ";", ","];
  const counts = candidates.map(() => [0]);
  let quoted = false,
    row = 0;
  for (let i = 0; i < source.length && row < 20; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && char === "\n") {
      if (counts.some((values) => values[row] > 0)) {
        row++;
        counts.forEach((values) => values.push(0));
      }
    } else if (!quoted) {
      const index = candidates.indexOf(char);
      if (index >= 0) counts[index][row]++;
    }
  }
  const scores = counts.map((values, index) => {
    const used = values.filter((value) => value > 0);
    if (!used.length) return -1;
    const consistent =
      used.filter((value) => value === used[0]).length / used.length;
    // Tabs are unambiguous in exported tables; commas commonly occur in translations.
    return (
      used.length * consistent * 100 + (index === 0 ? 3 : index === 1 ? 2 : 1)
    );
  });
  return candidates[scores.indexOf(Math.max(...scores))];
}
export function parseCSV(text: string, separator?: string): CsvWord[] {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = separator ?? detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (quoted) throw new Error("В CSV не закрыта кавычка");
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  if (!rows.length) throw new Error("Файл пуст");
  const header = rows[0].map((v) => v.trim().toLowerCase());
  const hasHeader = ["word", "term", "слово"].includes(header[0]);
  const start = hasHeader ? 1 : 0;
  const translationIndex = hasHeader
    ? header.findIndex((h) => ["translation", "перевод"].includes(h))
    : 1;
  if (translationIndex < 0)
    throw new Error("Не найдена колонка translation / перевод");
  const exampleIndex = header.indexOf("example");
  const tagsIndex = header.indexOf("tags");
  const result = rows.slice(start).map((columns, i) => {
    if (!columns[0]?.trim() || !columns[translationIndex]?.trim())
      throw new Error(`Строка ${i + start + 1}: нужны слово и перевод`);
    return {
      term: columns[0].trim(),
      translation: columns[translationIndex].trim(),
      example: exampleIndex >= 0 ? (columns[exampleIndex] ?? "") : "",
      tags:
        tagsIndex >= 0
          ? (columns[tagsIndex] ?? "").split("|").filter(Boolean)
          : [],
    };
  });
  if (!result.length) throw new Error("В файле нет слов");
  return result;
}
const csvCell = (value: string) => {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};
export function vocabularyCSV(words: CsvWord[]) {
  return (
    "\uFEFF" +
    [
      ["word", "translation", "example", "tags"].join(","),
      ...words.map((w) =>
        [w.term, w.translation, w.example ?? "", w.tags?.join("|") ?? ""]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function download(
  filename: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
