import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { selectPreferences } from "./preferences";
import { useSettings } from "../store/useSettings";
it("preserves existing guest preferences when opening the workspace", async () => {
  localStorage.setItem(
    "easy-learn-settings",
    JSON.stringify({
      version: 6,
      state: {
        settings: {
          strictAnswerCase: true,
          strictAnswerArticles: false,
          learningLanguage: "fr",
          profileName: "Guest",
        },
      },
    }),
  );
  await selectPreferences(null);
  expect(useSettings.getState().settings).toMatchObject({
    strictAnswerCase: true,
    strictAnswerArticles: false,
    learningLanguage: "fr",
    profileName: "Guest",
  });
  expect(
    JSON.parse(localStorage.getItem("easy-learn-settings")!).state.settings
      .strictAnswerCase,
  ).toBe(true);
});
