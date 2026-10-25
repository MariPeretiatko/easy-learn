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
it("detects TSV and semicolon tables with commas inside values", () => {
  expect(parseCSV("Haus\tдом, здание\nBaum\tдерево")[0]).toMatchObject({
    term: "Haus",
    translation: "дом, здание",
  });
  expect(parseCSV("word;translation\nHaus;дом, здание")[0].translation).toBe(
    "дом, здание",
  );
  expect(parseCSV('word,translation\n"a;b","x,y"')[0]).toMatchObject({
    term: "a;b",
    translation: "x,y",
  });
});
it("detects separators across multiline quoted fields and supports explicit separators", () => {
  expect(
    parseCSV('word\ttranslation\nHaus\t"дом,\nздание"')[0].translation,
  ).toBe("дом,\nздание");
  expect(parseCSV("Haus;дом, здание", ";")[0].translation).toBe("дом, здание");
});
