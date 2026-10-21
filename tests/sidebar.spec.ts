import { test, expect } from "@playwright/test";
test("sidebar overlays every page without moving content, including the set editor", async ({
  page,
}) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/library", "/create-set", "/sets/demo-deck"]) {
      await page.goto(route);
      if (route === "/create-set") {
        await page.getByLabel("Название колоды").fill("Черновик не теряется");
        await page.getByLabel("Термин 1", { exact: true }).fill("Haus");
      } else if (route.startsWith("/sets"))
        await page.locator(".set-flip-target").waitFor();
      else
        await page
          .getByRole("heading", { name: "Ваша библиотека", exact: true })
          .waitFor();
      const before = await page.locator("main").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      });
      await page.getByRole("button", { name: "Меню", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Меню", exact: true }),
      ).toHaveAttribute("aria-expanded", "true");
      const samples = await page.locator("main").evaluate(async (element) => {
        const measurements: { x: number; y: number; width: number }[] = [];
        for (let i = 0; i < 20; i++) {
          await new Promise(requestAnimationFrame);
          const rect = element.getBoundingClientRect();
          measurements.push({ x: rect.x, y: rect.y, width: rect.width });
        }
        return measurements;
      });
      for (const sample of samples) {
        expect(sample.x).toBeCloseTo(before.x, 1);
        expect(sample.y).toBeCloseTo(before.y, 1);
        expect(sample.width).toBeCloseTo(before.width, 1);
      }
      const sidebar = page.getByRole("complementary", {
        name: "Основная навигация",
      });
      await expect(
        sidebar.getByRole("link", { name: "Словарь", exact: true }),
      ).toBeVisible();
      await expect(
        sidebar.getByRole("link", { name: "Учебные группы", exact: true }),
      ).toHaveCount(0);
      await expect(
        sidebar.getByRole("link", { name: "Уведомления", exact: true }),
      ).toHaveCount(0);
      const settingsBox = await sidebar
        .getByRole("link", { name: "Настройки", exact: true })
        .boundingBox();
      expect(settingsBox!.y + settingsBox!.height).toBeLessThanOrEqual(1000);
      await page.keyboard.press("Escape");
      await expect(sidebar).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "Меню", exact: true }),
      ).toBeFocused();
      if (route === "/create-set") {
        await expect(page.getByLabel("Название колоды")).toHaveValue(
          "Черновик не теряется",
        );
        await expect(page.getByLabel("Термин 1", { exact: true })).toHaveValue(
          "Haus",
        );
      }
    }
  }
});
test("editor sidebar and menu stay usable with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/create-set");
  await page.getByLabel("Название колоды").fill("Без анимаций");
  await page.getByRole("button", { name: "Меню", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Меню", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Библиотека", exact: true }).click();
  await expect(page).toHaveURL(/library/);
  await expect(
    page.getByRole("button", { name: "Меню", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Создать материал" }).click();
  await expect(
    page.getByRole("link", { name: "Учебная группа", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Уведомления", exact: true }),
  ).toHaveCount(0);
});
