import { expect, it } from "vitest";
import { studyInterval } from "./useStudyTimer";
it("counts uninterrupted visible playback beyond the reading idle threshold", () => {
  expect(studyInterval("listeningMinutes", true, 15000, 600000)).toBe(0.25);
  expect(studyInterval("readingMinutes", true, 15000, 600000)).toBe(0);
  expect(studyInterval("listeningMinutes", false, 15000, 0)).toBe(0);
  expect(studyInterval("listeningMinutes", true, 1000, 0)).toBeCloseTo(1 / 60);
  expect(studyInterval("listeningMinutes", true, 600000, 0)).toBe(0.25);
});
