import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { createBackup, parseBackup } from "../services/backup";
import { currentDatabase, selectDatabase } from "../db/database";
import { newWord } from "../services/wordModel";
import { useSettings } from "../store/useSettings";
import { defaultSettings } from "../store/settingsDefaults";
import { importGuestLibrary } from "./migration";
it("merges matching subject names, remaps imported references and produces restorable backups", async () => {
  const backup = await createBackup();
  backup.settings = {
    ...defaultSettings,
    customSubjects: [
      { id: "custom-guest", name: "Японский", kind: "language" },
    ],
  };
  backup.words = [
    newWord({
      id: "imported",
      term: "猫",
      translation: "кошка",
      language: "custom-guest",
    }),
  ];
  await selectDatabase(`test-${crypto.randomUUID()}`);
  const database = currentDatabase();
  try {
    useSettings.setState({
      settings: {
        ...defaultSettings,
        customSubjects: [
          { id: "custom-account", name: "Японский", kind: "language" },
        ],
      },
    });
    await importGuestLibrary(backup);
    expect(useSettings.getState().settings.customSubjects).toHaveLength(1);
    expect((await database.words.get("imported"))?.language).toBe(
      "custom-account",
    );
    const exported = await createBackup(database);
    expect(() => parseBackup(JSON.stringify(exported))).not.toThrow();
  } finally {
    await selectDatabase(null);
    await database.delete();
    useSettings.setState({ settings: defaultSettings });
  }
});
