import { expect, it } from "vitest";
import { parseCardImport, swapCardSides } from "./editorModel";
it("validates delimited imports before replacing any existing cards", () => {
  expect(
    parseCardImport("Haus\tдом\nBaum\tдерево", "tab").cards.map(
      (card) => card.term,
    ),
  ).toEqual(["Haus", "Baum"]);
  expect(
    parseCardImport('word,translation\n"Haus","дом"', "auto").cards[0]
      .definition,
  ).toBe("дом");
  expect(parseCardImport("Haus\tдом\nbad row", "tab").error).toContain(
    "Строка 2",
  );
  expect(parseCardImport("Haus\tдом\nbad row", "tab").cards).toHaveLength(0);
});
it("swaps accepted answers with their corresponding sides and is reversible", () => {
  const card = {
    id: "a",
    term: "lernen",
    definition: "учить",
    acceptedTerms: ["studieren"],
    acceptedTranslations: ["учиться"],
    termImage: "a",
    image: "b",
  };
  expect(swapCardSides(card)).toMatchObject({
    term: "учить",
    definition: "lernen",
    acceptedTerms: ["учиться"],
    acceptedTranslations: ["studieren"],
    image: "a",
    termImage: "b",
  });
  expect(swapCardSides(swapCardSides(card))).toEqual(card);
});
