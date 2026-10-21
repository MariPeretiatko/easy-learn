import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Попробовать на примере", exact: true })
    .click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
}
test("card answer alternatives survive publishing and editing and are accepted in tests", async ({
  page,
}) => {
  await page.goto("/create-set");
  await page.getByLabel("Название колоды").fill("Допустимые ответы");
  await page.getByLabel("Термин 1", { exact: true }).fill("lernen");
  await page
    .getByLabel("Определение 1", { exact: true })
    .fill("учить, учиться");
  await page
    .locator(".card-accepted-answers")
    .first()
    .locator("summary")
    .click();
  await page
    .getByLabel("Другие варианты перевода 1", { exact: true })
    .fill("учиться\nобучаться");
  await page
    .getByLabel("Другие варианты термина 1", { exact: true })
    .fill("studieren");
  await page.getByLabel("Термин 2", { exact: true }).fill("der Hund");
  await page.getByLabel("Определение 2", { exact: true }).fill("собака");
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sets\//);
  const id = page.url().split("/").pop()!;
  await page.goto(`/learn?mode=test&deck=${id}`);
  let dialog = page.getByRole("dialog");
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
  for (const card of await page.locator(".question-card").all()) {
    const prompt = (await card.locator(".quiz-prompt").innerText()).trim();
    await card
      .getByRole("textbox")
      .fill(prompt === "lernen" ? "учиться" : "собака");
  }
  await page
    .getByRole("button", { name: "Проверить тест", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "100% правильных ответов" }),
  ).toBeVisible();
  await page.goto(`/sets/${id}`);
  await page
    .getByRole("button", { name: "Другие действия", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page
    .locator(".card-accepted-answers")
    .first()
    .locator("summary")
    .click();
  await expect(
    page.getByLabel("Другие варианты перевода 1", { exact: true }),
  ).toHaveValue("учиться\nобучаться");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/accepted-answers-mobile.png" });
  await page.goto(`/learn?mode=learn&deck=${id}`);
  dialog = page.getByRole("dialog");
  await dialog
    .getByText("Проверка письменных ответов", { exact: true })
    .click();
  await dialog.getByLabel("Учитывать регистр букв", { exact: true }).check();
  await dialog
    .getByLabel("Требовать артикли в немецком", { exact: true })
    .uncheck();
  await page.reload();
  await page.getByText("Проверка письменных ответов", { exact: true }).click();
  await expect(
    page.getByLabel("Учитывать регистр букв", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Требовать артикли в немецком", { exact: true }),
  ).not.toBeChecked();
});

test("written learn answers stay as drafts on blur and submit with Enter on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await page.goto("/learn?mode=learn&deck=demo-deck");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("switch", { name: "Выбор ответа", exact: true })
    .uncheck();
  await dialog
    .getByRole("switch", { name: "Ввести ответ", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Начать практику", exact: true })
    .click();
  const card = page.locator("#question-1");
  await card.getByRole("textbox").fill("неверный ответ");
  await card.locator(".quiz-prompt").click();
  await expect(card).not.toHaveClass(/answer-wrong/);
  await expect(card.getByRole("textbox")).toBeEnabled();
  await expect(card.locator(".correct-answer")).toHaveCount(0);
  await card.getByRole("textbox").press("Enter");
  await expect(card).toHaveClass(/answer-wrong/);
  await expect(card.locator(".correct-answer")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("adaptive learning returns a mistake after three tasks and finishes only when all words are consolidated", async ({
  page,
}) => {
  await demo(page);
  const dictionary = await page.evaluate(
    async () =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const open = indexedDB.open("easy-learn");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const tx = database.transaction(["words", "decks"], "readwrite");
          const get = tx.objectStore("decks").get("demo-deck");
          let result: Record<string, string> = {};
          get.onsuccess = () => {
            const deck = get.result;
            deck.wordIds = deck.wordIds.slice(0, 4);
            tx.objectStore("decks").put(deck);
            deck.wordIds.forEach((id: string, i: number) => {
              const req = tx.objectStore("words").get(id);
              req.onsuccess = () => {
                const word = req.result;
                result[word.term] = word.translation;
                word.status = i === 3 ? "mastered" : "new";
                word.reviewCount = i === 3 ? 10 : 0;
                word.nextReviewAt = i === 3 ? Date.now() + 86400000 : 0;
                tx.objectStore("words").put(word);
              };
            });
          };
          tx.oncomplete = () => {
            database.close();
            resolve(result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto("/learn?mode=learn&deck=demo-deck");
  await page.getByLabel("Язык ответа").selectOption("native");
  await page
    .getByRole("button", { name: "Начать практику", exact: true })
    .click();
  const terms: string[] = [];
  for (let attempt = 1; attempt <= 8; attempt++) {
    const card = page.locator(`#question-${attempt}`);
    await expect(card).toBeVisible();
    const term = (await card.locator(".quiz-prompt").innerText()).trim();
    terms.push(term);
    const correct = dictionary[term];
    const value =
      attempt === 1
        ? (await card.getByRole("button").allTextContents()).find(
            (value) => value !== correct,
          )!
        : correct;
    await card.getByRole("button", { name: value, exact: true }).click();
    if (attempt < 8)
      await expect(page.locator(`#question-${attempt + 1}`)).toBeVisible();
  }
  expect(terms.slice(1, 4)).not.toContain(terms[0]);
  expect(terms[4]).toBe(terms[0]);
  await expect(page.locator(".session-complete")).toContainText(
    "Закреплено карточек: 4 из 4",
  );
});

test("games offer one matching mode and old Blocks links open matching", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/games");
  await expect(page.locator(".game-tile")).toHaveCount(2);
  await expect(page.locator(".game-tiles")).not.toContainText("Blocks");
  await page.goto("/sets/demo-deck");
  await expect(page.locator(".set-game-card")).toHaveCount(2);
  await expect(page.locator(".set-game-gallery")).not.toContainText("Блоки");
  await page.goto("/learn?mode=blocks&deck=demo-deck");
  await page.getByRole("button", { name: "Начать игру", exact: true }).click();
  await expect(page.locator(".match-tile")).toHaveCount(12);
});
