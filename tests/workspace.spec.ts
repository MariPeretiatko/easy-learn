import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const translations: Record<string, string> = {
  Hund: "собака",
  Katze: "кошка",
  arbeiten: "работать",
  lernen: "учить, учиться",
  trotzdem: "несмотря на это",
  entdecken: "открывать, узнавать",
  Reise: "путешествие",
  Buch: "книга",
  Sprache: "язык",
  Freund: "друг",
  Zeit: "время",
  Welt: "мир",
};
async function demo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("link", { name: "Словарь", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
}
test("vocabulary persists; decks, SRS, typing quiz and match share the collection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("link", { name: "Библиотека", exact: true }).click();
  await page.getByRole("link", { name: /Немецкий на каждый день/ }).click();
  await expect(page.locator(".set-term-row")).toHaveCount(12);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Карточки", exact: true })
    .click();
  const firstTerm = (
    await page.locator(".flashcard strong").innerText()
  ).trim();
  await page.getByRole("button", { name: "Перевернуть карточку" }).click();
  await page.keyboard.press("3");
  await expect(page.locator(".session-bar")).toContainText("2 / 12");
  await page.goto(`/vocabulary?word=demo-word-${firstTerm.toLowerCase()}`);
  await expect(page.locator("dialog .stats-strip")).toContainText("1");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await page.goto("/learn?mode=test&deck=demo-deck");
  await page.getByLabel("Количество заданий").fill("2");
  await page.getByLabel("Выбор ответа", { exact: true }).uncheck();
  await page.getByLabel("Ввести ответ", { exact: true }).check();
  await page.getByLabel("Язык ответа").selectOption("native");
  await page.getByRole("button", { name: "Начать тест", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    const card = page.locator(`#question-${i + 1}`);
    const term = (await card.locator(".quiz-prompt").innerText()).trim();
    await expect(card.getByRole("textbox")).toBeEnabled();
    await card.getByRole("textbox").fill(translations[term]);
    await card.getByRole("textbox").press("Enter");
  }
  await page
    .getByRole("button", { name: "Проверить тест", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "100% правильных ответов" }),
  ).toBeVisible();
  await page.goto("/learn?mode=match&deck=demo-deck");
  await page.getByRole("button", { name: "Начать игру" }).click();
  const tiles = await page.locator(".match-tile").allTextContents();
  for (const term of tiles.filter((t) => translations[t])) {
    await page.getByRole("button", { name: term, exact: true }).click();
    await page
      .getByRole("button", { name: translations[term], exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Все пары найдены!" }),
  ).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("3 повторений", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("reader word creates source deck, highlights persist and review completes", async ({
  page,
}) => {
  await page.goto("/reader?add=1");
  await page.getByLabel("Название", { exact: true }).fill("Im Café");
  await page
    .getByLabel("Текст", { exact: true })
    .fill("Heute trinken wir Kaffee. Die Hunde spielen.");
  await page.getByRole("button", { name: "Сохранить текст" }).click();
  await page.getByRole("link", { name: "Im Café", exact: true }).click();
  await page.getByRole("button", { name: "Kaffee", exact: true }).click();
  await expect(page.getByLabel("Перевод", { exact: true })).toHaveValue("кофе");
  await page.getByRole("button", { name: "В словарь", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Kaffee", exact: true }),
  ).toHaveClass(/new/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Kaffee", exact: true }),
  ).toHaveClass(/new/);
  await page.getByRole("button", { name: "Hunde", exact: true }).click();
  await expect(page.locator("dialog .word-title")).toHaveText("Hund");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Прочитано", exact: true }).click();
  await expect(
    page.getByText("Текст прочитан. Отличная работа!", { exact: true }),
  ).toBeVisible();
  await page.goto("/reader");
  await expect(page.getByText("100% прочитано")).toBeVisible();
  await page.goto("/decks");
  await page.getByRole("link", { name: /Im Café/ }).click();
  await expect(page.locator(".set-term-row")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Повторить колоду", exact: true })
    .click();
  await page.getByRole("button", { name: "Перевернуть карточку" }).click();
  await page.getByRole("button", { name: /Хорошо/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ещё один шаг сделан." }),
  ).toBeVisible();
});
test("CSV preview deduplicates and a complete backup restores after clearing", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Импорт CSV", exact: true }).click();
  await page
    .getByLabel("Или вставьте CSV")
    .fill("word,translation\nHund,собака\nPfad,путь\nPfad,путь");
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(
    page.getByText("Готово к импорту: 3 строк.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Импортировать", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(13);
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON" }).click();
  const download = await downloadPromise;
  const path = (await download.path())!;
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.words).toHaveLength(13);
  expect(backup.decks).toHaveLength(1);
  expect(backup.texts).toHaveLength(1);
  expect(backup.settings.learningLanguage).toBe("de");
  await page
    .getByRole("button", { name: "Удалить все данные", exact: true })
    .click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(
    page.getByText("Все данные удалены", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Восстановить из JSON").setInputFiles(path);
  await page.getByRole("button", { name: "Заменить и восстановить" }).click();
  await expect(
    page.getByText("Резервная копия восстановлена", { exact: true }),
  ).toBeVisible();
  await page.goto("/vocabulary");
  await expect(page.locator("tbody tr")).toHaveCount(13);
  await page.goto("/settings");
  await page.getByLabel("Восстановить из JSON").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"words":[]}'),
  });
  await expect(
    page.getByText("В копии отсутствует decks", { exact: true }),
  ).toBeVisible();
  await page.goto("/vocabulary");
  await expect(page.locator("tbody tr")).toHaveCount(13);
});
test("responsive pages, global search and dark mode have no overflow or console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await demo(page);
  await page.goto("/search?q=Buch");
  await expect(page.getByRole("link", { name: "Buch книга" })).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("combobox", { name: /^Тема/ }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/vocabulary",
    "/decks",
    "/reader/demo-text",
    "/videos",
    "/learn",
    "/progress",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).not.toBeEmpty();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Открыть поиск", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Глобальный поиск" }),
  ).toBeFocused();
  await page.getByRole("textbox", { name: "Глобальный поиск" }).fill("Buch");
  await page.getByRole("textbox", { name: "Глобальный поиск" }).press("Enter");
  await expect(page.getByRole("link", { name: "Buch книга" })).toBeVisible();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Библиотека", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
