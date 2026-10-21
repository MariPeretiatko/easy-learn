import { defaultSettings, withDefaultSettings } from "./settingsDefaults";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../types";
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
    {
      name: "easy-learn-settings",
      version: 6,
      migrate: (stored) => {
        const state = stored as { settings?: Partial<Settings> };
        return {
          settings: withDefaultSettings(state.settings),
        };
      },
    },
  ),
);
