import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/library");
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
}

test("deck and library menus dismiss on outside press, Escape and selecting an action", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/sets/demo-deck");
  const trigger = page.getByRole("button", {
    name: "Другие действия",
    exact: true,
  });
  await trigger.click();
  await expect(page.locator(".set-actions-menu .row-dropdown")).toBeVisible();
  await page
    .getByRole("heading", { name: "Немецкий на каждый день", exact: true })
    .click();
  await expect(page.locator(".set-actions-menu .row-dropdown")).toHaveCount(0);
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
  await trigger.click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт", exact: true }).click();
  await download;
  await expect(page.locator(".set-actions-menu .row-dropdown")).toHaveCount(0);
  await page.goto("/library");
  await page
    .getByRole("button", { name: /Действия с колодой/ })
    .first()
    .click();
  await expect(page.locator(".row-dropdown")).toBeVisible();
  await page
    .getByRole("heading", { name: "Ваша библиотека", exact: true })
    .click();
  await expect(page.locator(".row-dropdown")).toHaveCount(0);
});

test.describe("touch screens", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  test("configuration and quiz cards fit small phones with comfortable touch targets", async ({
    page,
  }) => {
    await demo(page);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.goto("/learn?mode=test&deck=demo-deck");
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Настройте свой тест" }),
      ).toBeVisible();
      await dialog.getByLabel("Количество заданий").fill("1");
      await dialog
        .getByRole("button", { name: "Начать тест", exact: true })
        .tap();
      const card = page.locator("#question-1");
      await expect(card).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      const size = await card.locator(".choice").first().boundingBox();
      expect(size!.height).toBeGreaterThanOrEqual(48);
      await card.locator(".choice").first().tap();
      await expect(card).not.toHaveClass(/answer-(correct|wrong)/);
      await page
        .getByRole("button", { name: "Проверить тест", exact: true })
        .tap();
      await expect(page.locator(".session-complete")).toBeVisible();
    }
  });
  test("flashcards support horizontal swipes without flipping the next card", async ({
    page,
  }) => {
    await demo(page);
    await page.goto("/learn?mode=flashcards&deck=demo-deck");
    const card = page.locator(".flashcard");
    await expect(card).toBeVisible();
    const touch = await page.context().newCDPSession(page);
    const rect = (await card.boundingBox())!;
    const y = rect.y + rect.height / 2;
    async function swipe(from: number, to: number) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from, y }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: to, y }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await swipe(rect.x + rect.width * 0.85, rect.x + rect.width * 0.15);
    await expect(page.locator(".session-bar")).toContainText("2 / 12");
    await expect(card).not.toHaveClass(/flipped/);
    await swipe(rect.x + rect.width * 0.15, rect.x + rect.width * 0.85);
    await expect(page.locator(".session-bar")).toContainText("1 / 12");
  });
});
