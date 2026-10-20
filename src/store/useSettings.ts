import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../types";
export const defaultSettings: Settings = {
  learningLanguage: "de",
  nativeLanguage: "ru",
  newWordsGoal: 10,
  reviewsGoal: 20,
  minutesGoal: 15,
  direction: "forward",
  autoPronounce: false,
  theme: "light",
  fontSize: 21,
  lineHeight: 1.9,
  textWidth: 760,
  readerDark: false,
  longestStreak: 0,
  matchBest: {},
  notifications: false,
};
export const useSettings = create<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      update: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
    }),
    { name: "easy-learn-settings", version: 1 },
  ),
);
