import { test, expect, type Page } from "@playwright/test";

async function createDeck(page: Page, title: string, pairs: string[][]) {
  await page.goto("/create-set");
  await page.getByLabel("Название колоды").fill(title);
  for (const [i, [term, definition]] of pairs.entries()) {
    await page.getByLabel(`Термин ${i + 1}`, { exact: true }).fill(term);
    await page
      .getByLabel(`Определение ${i + 1}`, { exact: true })
      .fill(definition);
  }
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sets\//);
  return new URL(page.url()).pathname;
}

test("decks share dictionary cards and modules train their unique words", async ({
  page,
}) => {
  const first = await createDeck(page, "Дом", [
    ["Haus", "дом"],
    ["Baum", "дерево"],
  ]);
  const second = await createDeck(page, "Семья", [
    ["Haus", "дом"],
    ["Katze", "кошка"],
  ]);
  await page.goto("/vocabulary");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.goto("/library?tab=modules&new=course");
  await page.getByLabel("Название", { exact: true }).fill("Немецкий A1");
  await expect(page.getByLabel("Язык модуля")).toHaveValue("de");
  await page.getByRole("checkbox", { name: /Дом/ }).check();
  await page.getByRole("checkbox", { name: /Семья/ }).check();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page
    .locator(".collection-card")
    .filter({ hasText: "Немецкий A1" })
    .click();
  await expect(page.locator(".quizlet-set-row")).toHaveCount(2);
  await page.getByRole("link", { name: "Карточки", exact: true }).click();
  await expect(page.locator(".session-bar")).toContainText("1 / 3");
  await page.goto(second);
  await page
    .getByRole("button", { name: "Редактировать колоду", exact: true })
    .click();
  await page.getByLabel("Определение 1", { exact: true }).fill("жилище");
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(second);
  await page.goto(first);
  await expect(
    page.locator(".set-term-row").filter({ hasText: "Haus" }),
  ).toContainText("жилище");
  await page.goto(second);
  await page
    .getByRole("button", { name: "Редактировать колоду", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Удалить карточку 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .first()
    .click();
  await expect(page.locator(".set-term-row")).toHaveCount(1);
  await page.goto(first);
  await expect(page.locator(".set-term-row")).toHaveCount(2);
  await page.goto("/vocabulary");
  await expect(page.locator("tbody tr")).toHaveCount(3);
});

test("repeat and library stay separated by language and navigation has one creation flow", async ({
  page,
}) => {
  await createDeck(page, "Deutsch", [
    ["Haus", "дом"],
    ["Baum", "дерево"],
  ]);
  await page.getByLabel("Язык обучения").selectOption("en");
  await createDeck(page, "English", [
    ["house", "дом"],
    ["tree", "дерево"],
  ]);
  await page.goto("/library");
  await expect(page.locator(".quizlet-set-row")).toHaveCount(1);
  await expect(page.locator(".quizlet-set-row")).toContainText("English");
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  const navigation = page.getByRole("complementary");
  await expect(
    navigation
      .getByRole("navigation", { name: "Учебные инструменты", exact: true })
      .getByRole("link"),
  ).toHaveText([
    "Создать карточки",
    "Карточки",
    "Игры",
    "Словарь",
    "Повторение",
    "Чтение",
    "Видео",
    "Прогресс",
  ]);
  await navigation
    .getByRole("link", { name: "Повторение", exact: true })
    .click();
  await page.getByRole("tab", { name: "Колоды", exact: true }).click();
  await page
    .locator(".study-picker-option")
    .filter({ hasText: "English" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "Начать занятие", exact: true })
    .click();
  await expect(page.locator(".session-bar")).toContainText("1 / 2");
  await expect(page.locator(".flashcard strong")).toHaveText(/^(house|tree)$/);
  await page.getByLabel("Язык обучения").selectOption("de");
  await expect(page.locator(".flashcard strong")).toHaveText(/^(house|tree)$/);
  await page.getByRole("link", { name: "Изменить выбор", exact: true }).click();
  await page.getByRole("tab", { name: "Колоды", exact: true }).click();
  await page
    .locator(".study-picker-option")
    .filter({ hasText: "Deutsch" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "Начать занятие", exact: true })
    .click();
  await expect(page.locator(".session-bar")).toContainText("1 / 2");
  await expect(page.locator(".flashcard strong")).toHaveText(/^(Haus|Baum)$/);
  await page.goto("/library?tab=modules&new=course");
  await page.getByLabel("Название", { exact: true }).fill("Deutsch A1");
  await expect(page.getByRole("checkbox", { name: /Deutsch/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /English/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.goto("/decks");
  await expect(page).toHaveURL(/\/library$/);
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await navigation
    .getByRole("link", { name: "Создать карточки", exact: true })
    .click();
  await expect(page.getByLabel("Название колоды")).toBeVisible();
});
