import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import {
  addStudySubject,
  updateStudySubject,
  subjectSpeechCode,
} from "./subjects";
import { defaultSettings } from "../store/settingsDefaults";
import { useSettings } from "../store/useSettings";
import { newWord } from "./wordModel";
import { clearData, WordRepository } from "./repositories";
import { createBackup, parseBackup, restoreBackup } from "./backup";
import { db } from "../db/database";
beforeEach(async () => {
  await clearData();
  useSettings.getState().update({ ...defaultSettings, customSubjects: [] });
});
it("persists independent subjects, rejects duplicates and retains IDs when renaming", () => {
  const language = addStudySubject("Итальянский", "language", "it-IT");
  const topic = addStudySubject("История", "topic");
  expect(useSettings.getState().settings.learningLanguage).toBe(topic.id);
  expect(subjectSpeechCode(language.id)).toBe("it-IT");
  expect(subjectSpeechCode(topic.id)).toBe("ru");
  expect(() => addStudySubject(" история ", "language")).toThrow();
  expect(() => addStudySubject("Немецкий", "language")).toThrow();
  updateStudySubject({ ...language, name: "Italiano", speechCode: "it" });
  expect(useSettings.getState().settings.customSubjects[0]).toMatchObject({
    id: language.id,
    name: "Italiano",
  });
  expect(subjectSpeechCode(language.id)).toBe("it");
});
it("restores custom subjects together with their vocabulary and rejects unregistered IDs", async () => {
  const topic = addStudySubject("История", "topic");
  const word = newWord({
    term: "1789",
    translation: "Французская революция",
    language: topic.id,
  });
  await WordRepository.save(word);
  const backup = await createBackup();
  expect(parseBackup(JSON.stringify(backup)).words[0].language).toBe(topic.id);
  await clearData();
  useSettings.getState().update({ ...defaultSettings, customSubjects: [] });
  await restoreBackup(backup);
  expect((await db.words.get(word.id))?.language).toBe(topic.id);
  expect(useSettings.getState().settings.customSubjects).toEqual([topic]);
  const invalid = JSON.parse(JSON.stringify(backup));
  invalid.settings.customSubjects = [];
  expect(() => parseBackup(JSON.stringify(invalid))).toThrow();
});
it("accepts older backups with no custom-subject field", async () => {
  const backup = JSON.parse(JSON.stringify(await createBackup()));
  delete backup.settings.customSubjects;
  expect(parseBackup(JSON.stringify(backup)).settings.customSubjects).toEqual(
    [],
  );
});
