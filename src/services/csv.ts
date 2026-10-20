export interface CsvWord {
  term: string;
  translation: string;
  example?: string;
  tags?: string[];
}
export function parseCSV(text: string): CsvWord[] {
  const source = text.replace(/^\uFEFF/, "");
  const first = source.split(/\r?\n/)[0] ?? "";
  const delimiter =
    first.includes(";") && !first.includes(",")
      ? ";"
      : first.includes("\t") && !first.includes(",")
        ? "\t"
        : ",";
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
