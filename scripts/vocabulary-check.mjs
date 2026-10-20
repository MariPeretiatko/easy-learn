import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/vocabulary");
await page
  .getByRole("button", { name: "Добавить слово", exact: true })
  .first()
  .click();
await page.getByLabel("Слово или выражение *").fill("Prüfung");
await page.getByLabel("Перевод *", { exact: true }).fill("проверка");
await page.getByRole("button", { name: "Сохранить", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Prüfung", exact: true }),
).toBeVisible();
await page.reload();
await expect(
  page.getByRole("button", { name: "Prüfung", exact: true }),
).toBeVisible();
await page
  .getByRole("button", { name: "Добавить слово", exact: true })
  .first()
  .click();
await page.getByLabel("Слово или выражение *").fill("prüfung");
await page.getByLabel("Перевод *", { exact: true }).fill("дубликат");
await page.getByRole("button", { name: "Сохранить", exact: true }).click();
await expect(page.getByRole("alert")).toContainText("уже есть");
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Vocabulary CRUD, reload persistence and duplicate detection passed.",
);
