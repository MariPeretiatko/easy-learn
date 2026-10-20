import { it, expect } from "vitest";
import { streaks } from "./metrics";
import { emptyDay } from "../../services/repositories";
it("allows today to be incomplete and ignores word additions as study", () => {
  const days = ["2026-10-16", "2026-10-17", "2026-10-18"].map((date) => ({
    ...emptyDay(date),
    wordsReviewed: 1,
  }));
  expect(
    streaks(
      [...days, { ...emptyDay("2026-10-19"), wordsAdded: 10 }],
      new Date("2026-10-19T12:00:00"),
    ),
  ).toEqual({ current: 3, longest: 3 });
  expect(streaks(days, new Date("2026-10-21T12:00:00"))).toEqual({
    current: 0,
    longest: 3,
  });
});
