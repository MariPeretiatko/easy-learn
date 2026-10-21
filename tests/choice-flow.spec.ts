import { test, expect, type Page } from "@playwright/test";

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
  await page.goto("/library");
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
}

test("learn answers animate and advance, without a question limit", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/learn?mode=learn&deck=demo-deck");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Количество заданий")).toHaveCount(0);
  await expect(dialog).toContainText("все 12 карточек");
  await dialog.getByLabel("Язык ответа").selectOption("native");
  await dialog
    .getByRole("button", { name: "Начать практику", exact: true })
    .click();
  const first = page.locator("#question-1");
  const term = (await first.locator(".quiz-prompt").innerText()).trim();
  await first
    .getByRole("button", { name: translations[term], exact: true })
    .click();
  await expect(first).toHaveClass(/answer-correct/);
  await expect(page.locator("#question-2")).toBeVisible();
});

test("test hides correctness, allows changing choices and checks only at the end", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/learn?mode=test&deck=demo-deck");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Количество заданий").fill("3");
  await dialog.getByLabel("Язык ответа").selectOption("native");
  await dialog
    .getByRole("button", { name: "Начать тест", exact: true })
    .click();
  const check = page.getByRole("button", {
    name: "Проверить тест",
    exact: true,
  });
  await expect(check).toBeDisabled();
  for (let i = 0; i < 3; i++) {
    const card = page.locator(`#question-${i + 1}`);
    const term = (await card.locator(".quiz-prompt").innerText()).trim();
    const wrong = (await card.getByRole("button").allTextContents()).find(
      (value) => value !== translations[term],
    )!;
    await card.getByRole("button", { name: wrong, exact: true }).click();
    if (i !== 1)
      await card
        .getByRole("button", { name: translations[term], exact: true })
        .click();
    await expect(card.locator(".selected")).toHaveCount(1);
  }
  await expect(
    page.locator(".answer-correct,.answer-wrong,.choice.correct,.choice.wrong"),
  ).toHaveCount(0);
  await expect(page.locator(".session-complete")).toHaveCount(0);
  await check.click();
  await expect(
    page.getByRole("heading", { name: "67% правильных ответов" }),
  ).toBeVisible();
});

test("written test answers remain editable and reveal corrections only after checking", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/learn?mode=test&deck=demo-deck");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Количество заданий").fill("2");
  await dialog.getByLabel("Язык ответа").selectOption("native");
  await dialog
    .getByRole("switch", { name: "Выбор ответа", exact: true })
    .uncheck();
  await dialog
    .getByRole("switch", { name: "Ввести ответ", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Начать тест", exact: true })
    .click();
  const first = page.locator("#question-1");
  const term = (await first.locator(".quiz-prompt").innerText()).trim();
  await first.getByRole("textbox").fill(translations[term]);
  await first.getByRole("textbox").press("Enter");
  const second = page.locator("#question-2");
  await second.getByRole("textbox").fill("неверный ответ");
  await expect(
    page.locator(
      ".correct-answer,.quiz-written-answer.correct,.quiz-written-answer.wrong",
    ),
  ).toHaveCount(0);
  const check = page.getByRole("button", {
    name: "Проверить тест",
    exact: true,
  });
  await second.getByRole("textbox").fill("");
  await expect(check).toBeDisabled();
  await second.getByRole("textbox").fill("неверный ответ");
  await check.click();
  await expect(
    page.getByRole("heading", { name: "50% правильных ответов" }),
  ).toBeVisible();
  await expect(page.locator(".result-list")).toContainText("неверный ответ");
});

test("learn displays the correct written answer before moving on", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/learn?mode=learn&deck=demo-deck");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Язык ответа").selectOption("native");
  await dialog
    .getByRole("switch", { name: "Выбор ответа", exact: true })
    .uncheck();
  await dialog
    .getByRole("switch", { name: "Ввести ответ", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Начать практику", exact: true })
    .click();
  const first = page.locator("#question-1");
  const term = (await first.locator(".quiz-prompt").innerText()).trim();
  await first.getByRole("textbox").fill("неверный ответ");
  await first.getByRole("textbox").press("Enter");
  await expect(first.locator(".correct-answer strong")).toHaveText(
    translations[term],
  );
  await expect(first).toHaveClass(/answer-wrong/);
  await expect(page.locator("#question-2")).toBeVisible();
});

test("boolean test answers are checked at the end", async ({ page }) => {
  await demo(page);
  await page.goto("/learn?mode=test&deck=demo-deck");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Количество заданий").fill("1");
  await dialog.getByLabel("Язык ответа").selectOption("native");
  await dialog
    .getByRole("switch", { name: "Выбор ответа", exact: true })
    .uncheck();
  await dialog
    .getByRole("switch", { name: "Верно / неверно", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Начать тест", exact: true })
    .click();
  const card = page.locator("#question-1");
  const term = (await card.locator(".quiz-prompt").innerText())
    .split("\n")[0]
    .trim();
  const candidate = (
    await card.locator(".boolean-candidate").innerText()
  ).trim();
  await card
    .getByRole("button", {
      name: translations[term] === candidate ? "Верно" : "Неверно",
      exact: true,
    })
    .click();
  await expect(card).not.toHaveClass(/answer-correct/);
  await page
    .getByRole("button", { name: "Проверить тест", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "100% правильных ответов" }),
  ).toBeVisible();
});

test("matching test supports changing pairs without revealing correctness", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/learn?mode=test&deck=demo-deck");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Количество заданий").fill("1");
  await dialog
    .getByRole("switch", { name: "Выбор ответа", exact: true })
    .uncheck();
  await dialog.getByRole("switch", { name: "Подбор", exact: true }).check();
  await dialog
    .getByRole("button", { name: "Начать тест", exact: true })
    .click();
  const left = page.locator(".quiz-pair-grid > div").first();
  const right = page.locator(".quiz-pair-grid > div").last();
  const terms = await left.getByRole("button").allTextContents();
  await left.getByRole("button", { name: terms[0], exact: true }).click();
  await right
    .getByRole("button", { name: translations[terms[1]], exact: true })
    .click();
  await expect(page.locator(".quiz-pair.wrong,.quiz-pair.correct")).toHaveCount(
    0,
  );
  for (const term of terms) {
    // Pair badges are appended after a connection is made.
    await left.getByRole("button").filter({ hasText: term }).click();
    await right
      .getByRole("button")
      .filter({ hasText: translations[term] })
      .click();
  }
  await page
    .getByRole("button", { name: "Проверить тест", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "100% правильных ответов" }),
  ).toBeVisible();
});
