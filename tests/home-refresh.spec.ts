import { test, expect } from "@playwright/test";

test("home, library and folder creation stay simple on desktop and mobile", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
      page.getByRole("heading", { name: "Как вы хотите заниматься?" }),
    ).toBeVisible();
    await expect(page.locator(".discovery-card")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Меню", exact: true }).click();
    const sidebar = page.getByRole("complementary", {
      name: "Основная навигация",
    });
    await expect(
      sidebar.getByRole("link", { name: "Главная", exact: true }),
    ).toBeVisible();
    await sidebar
      .getByRole("link", { name: "Библиотека", exact: true })
      .click();
    await expect(page.getByRole("tab")).toHaveCount(2);
    await page.getByRole("tab", { name: "Папки", exact: true }).click();
    await page
      .getByRole("button", { name: "Создать папку", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("input")).toHaveCount(1);
    await expect(dialog.locator("textarea, select")).toHaveCount(0);
    await dialog.getByLabel("Название", { exact: true }).fill(`Папка ${width}`);
    await dialog.getByRole("button", { name: "Создать", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: `Папка ${width}` }),
    ).toBeVisible();
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Ежедневные цели" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Комфортное чтение" }),
    ).toHaveCount(0);
  }
});

test("sidebar keeps the last five opened modules and decks across reloads", async ({
  page,
}) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
  await page.locator(".quizlet-set-row a").first().click();
  await page.locator(".set-flip-target").waitFor();
  for (let i = 0; i < 6; i++) {
    await page.goto("/library?tab=modules&new=course");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Название", { exact: true }).fill(`Модуль ${i}`);
    await dialog.getByRole("button", { name: "Создать", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("link", { name: `Модуль ${i}`, exact: false }).click();
    await page
      .getByRole("heading", { name: `Модуль ${i}`, exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Меню", exact: true }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Недавно открытые", exact: true })
        .getByRole("link")
        .first(),
    ).toHaveText(`Модуль ${i}`);
    await page.keyboard.press("Escape");
  }
  await page.reload();
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  const recent = page.getByRole("navigation", {
    name: "Недавно открытые",
    exact: true,
  });
  await expect(recent.getByRole("link")).toHaveCount(5);
  await expect(recent.getByRole("link").first()).toHaveText("Модуль 5");
  await expect(
    recent.getByRole("link", { name: "Модуль 0", exact: true }),
  ).toHaveCount(0);
});
