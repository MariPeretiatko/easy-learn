import { describe, it, expect } from "vitest";
import { parseSubtitles, youtubeId } from "./subtitles";
describe("YouTube content import", () => {
  it("accepts common URLs and rejects lookalike hosts", () => {
    expect(youtubeId("https://youtu.be/M7lc1UVf-VE?t=1")).toBe("M7lc1UVf-VE");
    expect(youtubeId("https://youtube.com/shorts/M7lc1UVf-VE")).toBe(
      "M7lc1UVf-VE",
    );
    expect(
      youtubeId("https://evil-youtube.com/watch?v=M7lc1UVf-VE"),
    ).toBeNull();
  });
  it("reads SRT and VTT millisecond timestamps", () => {
    expect(
      parseSubtitles("1\n00:00:01,500 --> 00:00:04,000\nHallo!")[0],
    ).toEqual({ start: 1.5, end: 4, text: "Hallo!" });
    expect(
      parseSubtitles("WEBVTT\n\n00:01.500 --> 00:04.000\nHallo!")[0].start,
    ).toBe(1.5);
  });
  it("rejects invalid cue ranges and invalid JSON", () => {
    expect(() => parseSubtitles('[{"start":4,"end":2,"text":"x"}]')).toThrow();
    expect(() => parseSubtitles("No timestamps")).toThrow();
  });
});
