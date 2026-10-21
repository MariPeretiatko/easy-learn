import { test, expect } from "@playwright/test";
test("production PWA reloads and edits the local library with the network offline", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    process.env.E2E_PRODUCTION !== "1" && !baseURL?.includes("4173"),
    "Requires the production preview on port 4173",
  );
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("link", { name: "Словарь", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await page
    .getByRole("button", { name: "Добавить слово", exact: true })
    .first()
    .click();
  await page.getByLabel("Слово или выражение *").fill("offline");
  await page.getByLabel("Перевод *", { exact: true }).fill("без сети");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(13);
  await page.goto("/reader/demo-text");
  await expect(
    page.getByRole("heading", { name: "Ein kleiner Schritt" }).first(),
  ).toBeVisible();
  await page.goto("/vocabulary");
  await expect(page.locator("tbody tr")).toHaveCount(13);
  await context.setOffline(false);
});
