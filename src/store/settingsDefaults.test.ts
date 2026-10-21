import { expect, it } from "vitest";
import { withDefaultSettings } from "./settingsDefaults";
it("keeps profile and learning rules while dropping abandoned settings from older profiles", () => {
  const saved = {
    theme: "dark" as const,
    profileName: "Мария",
    strictAnswerCase: true,
    notifications: true,
    newWordsGoal: 10,
    reviewsGoal: 20,
    minutesGoal: 15,
  };
  const settings = withDefaultSettings(saved);
  expect(settings).toMatchObject({
    theme: "dark",
    profileName: "Мария",
    strictAnswerCase: true,
    strictAnswerArticles: true,
    customSubjects: [],
  });
  for (const key of [
    "notifications",
    "newWordsGoal",
    "reviewsGoal",
    "minutesGoal",
  ])
    expect(settings).not.toHaveProperty(key);
});
