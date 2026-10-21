import { test, expect } from "@playwright/test";
test("custom languages and topics are saved, selectable and editable", async ({
  page,
}) => {
  await page.goto("/library");
  const selector = page.getByRole("combobox", {
    name: "Язык обучения",
    exact: true,
  });
  await selector.selectOption("__add_subject__");
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Общая тема", { exact: true }).check();
  await dialog.getByLabel("Название", { exact: true }).fill("История");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  const id = await selector.inputValue();
  expect(id).toMatch(/^topic-/);
  await page.reload();
  await expect(selector).toHaveValue(id);
  await expect(selector.locator("option:checked")).toHaveText("История");
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Добавить язык или тему", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название", { exact: true }).fill("Итальянский");
  await dialog
    .getByText("Произношение (необязательно)", { exact: true })
    .click();
  await dialog.getByLabel("Код языка для озвучки").fill("it");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(selector.locator("option:checked")).toHaveText("Итальянский");
  await page
    .getByRole("button", { name: "Редактировать История", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Название", { exact: true })
    .fill("Всемирная история");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await selector.selectOption(id);
  await expect(selector.locator("option:checked")).toHaveText(
    "Всемирная история",
  );
  await page.reload();
  await expect(selector).toHaveValue(id);
  await page.goto("/1014899522/autosaved");
  await page.getByLabel("Название колоды").fill("Даты революций");
  await page.getByLabel("Термин 1", { exact: true }).fill("1789");
  await page
    .getByLabel("Определение 1", { exact: true })
    .fill("Французская революция");
  await page.getByLabel("Термин 2", { exact: true }).fill("1917");
  await page
    .getByLabel("Определение 2", { exact: true })
    .fill("Октябрьская революция");
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Даты революций", exact: true }),
  ).toBeVisible();
  await page.goto("/library");
  await expect(page.locator(".quizlet-set-row")).toContainText(
    "Даты революций",
  );
  await selector.selectOption("de");
  await expect(page.locator(".quizlet-set-row")).toHaveCount(0);
  await selector.selectOption(id);
  await expect(page.locator(".quizlet-set-row")).toContainText(
    "Даты революций",
  );
});
