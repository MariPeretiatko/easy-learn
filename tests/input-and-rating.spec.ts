import { expect, test } from "@playwright/test";

test("long editor text grows without internal scrollbars and survives reload", async ({
  page,
}) => {
  await page.goto("/create-set");
  await page.getByLabel("Название колоды").fill("Длинные карточки");
  const term = page.getByLabel("Термин 1", { exact: true });
  const text = Array.from(
    { length: 18 },
    (_, i) => `Строка ${i + 1}: длинный текст карточки`,
  ).join("\n");
  await term.fill(text);
  await page.getByLabel("Определение 1", { exact: true }).fill("перевод");
  const assertFits = async () => {
    await expect
      .poll(() =>
        term.evaluate(
          (field: HTMLTextAreaElement) =>
            field.scrollHeight - field.clientHeight,
        ),
      )
      .toBeLessThanOrEqual(1);
    await expect(term).toHaveCSS("overflow-y", "hidden");
    await expect(term).toHaveCSS("resize", "none");
  };
  await assertFits();
  const expanded = (await term.boundingBox())!.height;
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  await page.reload();
  await expect(term).toHaveValue(text);
  await assertFits();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertFits();
  await term.fill("Haus");
  await expect
    .poll(async () => (await term.boundingBox())!.height)
    .toBeLessThan(expanded);
  await assertFits();
});

test("flashcards can be rated by button and keyboard before revealing the translation", async ({
  page,
}) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
  await page.goto("/learn?mode=flashcards&deck=demo-deck");
  await expect(page.locator(".flashcard")).not.toHaveClass(/flipped/);
  await expect(
    page.getByText("Сначала откройте перевод, затем оцените ответ."),
  ).toHaveCount(0);
  await page.locator(".rating.good").click();
  await expect(page.locator(".session-bar")).toContainText("2 / 12");
  await page.keyboard.press("4");
  await expect(page.locator(".session-bar")).toContainText("3 / 12");
  await page
    .getByRole("button", { name: "Предыдущая карточка", exact: true })
    .click();
  await expect(page.locator(".rating.good")).toBeDisabled();
  await page.goto("/progress");
  await expect(page.getByText("2 повторений", { exact: true })).toBeVisible();
});
