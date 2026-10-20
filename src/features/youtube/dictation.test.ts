import { it, expect } from "vitest";
import { compareDictation } from "./dictation";
it("aligns dictation without shifting every word after an omission", () => {
  const result = compareDictation(
    "Ich lerne jeden Tag Deutsch.",
    "ich lerne Deutsch",
  );
  expect(result.accuracy).toBe(60);
  expect(
    result.tokens.filter((t) => t.status === "missing").map((t) => t.text),
  ).toEqual(["jeden", "Tag"]);
  expect(result.tokens.at(-1)?.status).toBe("correct");
});
it("penalizes extra words", () =>
  expect(
    compareDictation("Hello world", "Hello wonderful world").accuracy,
  ).toBe(67));
