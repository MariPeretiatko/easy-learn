import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

for (const [mode, css] of [
  ["learn", "learn"],
  ["flashcards", "flashcards"],
  ["test", "test"],
  ["match", "match"],
]) {
  test(`home ${mode} asks for materials and starts only the chosen module`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(`.discovery-${css}`).click();
    await expect(page.locator(".study-picker")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Начать занятие", exact: true }),
    ).toBeDisabled();
    await expect(
      page.locator(".quiz-panel, .flashcard, .match-grid"),
    ).toHaveCount(0);
    await page.getByLabel("Папка / уровень").selectOption({ label: "A1" });
    await expect(page.locator(".study-picker-option")).toHaveCount(11);
    const option = page
      .locator(".study-picker-option")
      .filter({ hasText: "Природа и экология" });
    await option.getByRole("checkbox").check();
    await expect(page.locator(".study-picker-footer")).toContainText("27 слов");
    await page
      .getByRole("button", { name: "Начать занятие", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`mode=${mode}.*collection=`));
    if (mode === "learn")
      await expect(page.getByLabel("Количество заданий")).toHaveCount(0);
    if (mode === "test")
      await expect(page.getByLabel("Количество заданий")).toHaveAttribute(
        "max",
        "27",
      );
    if (mode === "flashcards")
      await expect(page.locator(".session-bar")).toContainText("1 / 27");
    if (mode === "match")
      await expect(page.locator(".study-picker")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Изменить выбор", exact: true }),
    ).toBeVisible();
  });
}

test("multiple decks work on mobile without including the rest of the dictionary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/learn?mode=flashcards");
  await page.getByRole("tab", { name: "Колоды", exact: true }).click();
  await page.getByLabel("Папка / уровень").selectOption({ label: "A1" });
  await expect(page.locator(".study-picker-option")).toHaveCount(50);
  const options = page.locator(".study-picker-option");
  let total = 0;
  for (let i = 0; i < 2; i++) {
    total += Number(
      (await options.nth(i).locator("small").innerText()).match(
        /(\d+) слов/,
      )![1],
    );
    await options.nth(i).getByRole("checkbox").check();
  }
  await expect(page.locator(".study-picker-footer")).toContainText(
    `2 колод · ${total} слов`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Начать занятие", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.getAll("deck")).toHaveLength(2);
  await expect(page.locator(".session-bar")).toContainText(`1 / ${total}`);
});

test("a missing module never falls back to the full dictionary", async ({
  page,
}) => {
  await page.goto("/learn?mode=test&collection=missing-module");
  await expect(
    page.getByRole("heading", { name: "Материалы не найдены" }),
  ).toBeVisible();
  await expect(page.locator(".quiz-panel")).toHaveCount(0);
});

test("several modules can be combined across levels while preserving the selected scope", async ({
  page,
}) => {
  await page.goto("/learn?mode=test");
  await page.getByLabel("Папка / уровень").selectOption({ label: "A1" });
  await page
    .locator(".study-picker-option")
    .filter({ hasText: "Природа и экология" })
    .getByRole("checkbox")
    .check();
  await page.getByLabel("Папка / уровень").selectOption({ label: "A2" });
  await page
    .locator(".study-picker-option")
    .filter({ hasText: "Природа и экология" })
    .getByRole("checkbox")
    .check();
  await expect(page.locator(".study-picker-footer")).toContainText("2 модулей");
  await expect(page.locator(".study-picker-footer")).toContainText("78 слов");
  await page
    .getByRole("button", { name: "Начать занятие", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.getAll("collection")).toHaveLength(2);
  await expect(page.getByLabel("Количество заданий")).toHaveAttribute(
    "max",
    "78",
  );
});
