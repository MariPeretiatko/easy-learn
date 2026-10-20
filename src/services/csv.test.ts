import { it, expect } from "vitest";
import { parseCSV, vocabularyCSV } from "./csv";
it("roundtrips Unicode, commas, quotes and newlines", () => {
  const words = [
    {
      term: "Grüße",
      translation: 'привет, "мир"',
      example: "Line 1\nLine 2",
      tags: ["A1", "Travel"],
    },
  ];
  expect(parseCSV(vocabularyCSV(words))).toEqual(words);
});
it("rejects incomplete rows before import", () => {
  expect(() => parseCSV("word,translation\nHund,")).toThrow();
  expect(() => parseCSV('word,translation\n"Hund,dog')).toThrow();
});
it("escapes spreadsheet formula cells", () =>
  expect(vocabularyCSV([{ term: "=CMD()", translation: "test" }])).toContain(
    "'=CMD()",
  ));
