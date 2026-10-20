import { describe, it, expect } from "vitest";
import { scheduleReview } from "./srs";
describe("spaced repetition", () => {
  const word = { interval: 0, difficulty: 2, reviewCount: 0 };
  it("relearns failed cards after ten minutes", () => {
    const r = scheduleReview(word, "again", 1000);
    expect(r.nextReviewAt).toBe(601000);
    expect(r.status).toBe("learning");
  });
  it("grows intervals after successful repetition", () => {
    const good = scheduleReview(word, "good", 0);
    const next = scheduleReview(
      { ...word, ...good, reviewCount: 1 },
      "good",
      0,
    );
    expect(next.interval).toBeGreaterThan(good.interval);
    expect(next.status).toBe("review");
  });
  it("gives easier cards longer intervals and bounds difficulty", () => {
    expect(scheduleReview(word, "easy", 0).interval).toBeGreaterThan(
      scheduleReview(word, "good", 0).interval,
    );
    expect(scheduleReview({ ...word, difficulty: 5 }, "again").difficulty).toBe(
      5,
    );
  });
  it("returns a mastered card to learning after a failure", () => {
    expect(
      scheduleReview({ ...word, interval: 80, reviewCount: 10 }, "again")
        .status,
    ).toBe("learning");
  });
});
