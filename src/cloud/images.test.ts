import { expect, it } from "vitest";
import { withoutCardImages } from "./images";
it("discards legacy images at any depth without interpreting vocabulary text as media", () => {
  expect(
    withoutCardImages({
      term: "storage://owner/example",
      translation: "data:image/png;base64,example",
      image: "storage://owner/missing",
      termImage: "data:image/png;base64,old",
      cards: [{ id: "c", image: "missing", term: "text" }],
      baseline: { image: "old", term: "baseline" },
    }),
  ).toEqual({
    term: "storage://owner/example",
    translation: "data:image/png;base64,example",
    cards: [{ id: "c", term: "text" }],
    baseline: { term: "baseline" },
  });
});
it("preserves unchanged references and leaves the original legacy data intact", () => {
  const text = { cards: [{ id: "c", term: "text" }] };
  expect(withoutCardImages(text)).toBe(text);
  const legacy = { cards: [{ ...text.cards[0], image: "legacy" }] };
  expect(withoutCardImages(legacy)).toEqual(text);
  expect(legacy.cards[0].image).toBe("legacy");
});
