import type { Settings } from "../types";
export const defaultSettings: Settings = {
  learningLanguage: "de",
  customSubjects: [],
  strictAnswerCase: false,
  strictAnswerArticles: true,
  nativeLanguage: "ru",
  direction: "forward",
  autoPronounce: false,
  theme: "light",
  fontSize: 21,
  lineHeight: 1.9,
  textWidth: 760,
  readerDark: false,
  longestStreak: 0,
  matchBest: {},
};
export function withDefaultSettings(stored: Partial<Settings> = {}): Settings {
  const settings = { ...defaultSettings, ...stored };
  for (const key of [
    "newWordsGoal",
    "reviewsGoal",
    "minutesGoal",
    "notifications",
  ])
    delete (settings as unknown as Record<string, unknown>)[key];
  return settings;
}
