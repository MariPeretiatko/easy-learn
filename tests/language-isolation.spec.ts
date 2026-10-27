import { test, expect } from "@playwright/test";
import { newWord } from "../src/services/wordModel";

test("language switching isolates folders, modules, drafts, recents and search, and preserves empty folders", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Экспорт JSON", exact: true })
    .waitFor();
  const words = [
    newWord({
      id: "scope-de-word",
      term: "Scope Haus",
      translation: "дом",
      language: "de",
    }),
    newWord({
      id: "scope-en-word",
      term: "Scope House",
      translation: "дом",
      language: "en",
    }),
  ];
  await page.evaluate(async (words) => {
    const group = (id: string, title: string, extra = {}) => ({
      id,
      title,
      kind: "folder",
      description: "",
      deckIds: [],
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    });
    const open = indexedDB.open("easy-learn");
    await new Promise<void>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const tx = database.transaction(
          ["words", "decks", "collections", "drafts", "recent"],
          "readwrite",
        );
        for (const word of words) {
          tx.objectStore("words").put(word);
          const language = word.language;
          const id = `scope-${language}-deck`;
          tx.objectStore("decks").put({
            id,
            title: `Scope ${language} deck`,
            language,
            description: "",
            tags: [],
            wordIds: [word.id],
            createdAt: 1,
            updatedAt: 1,
            favorite: false,
          });
          tx.objectStore("recent").put({
            key: `decks/${id}`,
            id,
            title: `Scope ${language} deck`,
            kind: "decks",
            timestamp: 1,
          });
          tx.objectStore("drafts").put({
            id: `scope-${language}-draft`,
            title: `Scope ${language} draft`,
            description: "",
            language,
            nativeLanguage: "ru",
            cards: [{ id: "c", term: "Scope", definition: "тест" }],
            createdAt: 1,
            updatedAt: 1,
          });
        }
        // German legacy folder has no language and no direct decks.
        tx.objectStore("collections").put(
          group("scope-de-folder", "Scope German folder"),
        );
        tx.objectStore("collections").put(
          group("scope-de-module", "Scope German module", {
            kind: "course",
            language: "de",
            folderId: "scope-de-folder",
            deckIds: ["scope-de-deck"],
          }),
        );
        tx.objectStore("collections").put(
          group("scope-en-folder", "Scope English folder", { language: "en" }),
        );
        tx.objectStore("collections").put(
          group("scope-en-module", "Scope English module", {
            kind: "course",
            language: "en",
            folderId: "scope-en-folder",
            deckIds: ["scope-en-deck"],
          }),
        );
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, words);
  await page.goto("/library?tab=folders");
  await expect(
    page.getByRole("heading", { name: "Scope German folder", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Scope English folder", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Модули", exact: true }).click();
  await page.getByLabel("Уровень модулей").selectOption("scope-de-folder");
  await page.getByLabel("Язык обучения").selectOption("en");
  await expect(page.getByLabel("Уровень модулей")).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Scope English module", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Scope German module", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".draft-row")).toContainText("Scope en draft");
  await expect(page.locator(".draft-row")).not.toContainText("Scope de draft");
  await page.getByRole("tab", { name: "Папки", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scope English folder", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Создать папку", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Название", { exact: true })
    .fill("Empty English folder");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Создать", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Empty English folder", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Язык обучения").selectOption("de");
  await expect(
    page.getByRole("tab", { name: "Папки", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Папки", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scope German folder", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Empty English folder", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Язык обучения").selectOption("en");
  await page.goto("/search?q=Scope");
  await expect(page.locator(".search-results")).toContainText("Scope House");
  await expect(page.locator(".search-results")).not.toContainText("Scope Haus");
  await expect(page.locator(".search-results")).not.toContainText(
    "Scope German",
  );
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Недавно открытые", exact: true }),
  ).toContainText("Scope en deck");
  await expect(
    page.getByRole("navigation", { name: "Недавно открытые", exact: true }),
  ).not.toContainText("Scope de deck");
  await page.goto("/folders/scope-de-folder");
  await expect(
    page.getByRole("heading", { name: "Коллекция не найдена", exact: true }),
  ).toBeVisible();
});
