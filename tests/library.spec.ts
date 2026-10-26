import { test, expect, type Page } from "@playwright/test";
async function demo(page: Page) {
  await page.goto("/library");
  await page.getByRole("button", { name: "Попробовать на примере" }).click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
}
test("autosaved editor resumes edits, imports, formats, reorders and publishes a complete module", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/1014899522/autosaved");
  await page.getByLabel("Название колоды").fill("Meine Reise");
  await page.getByLabel("Термин 1", { exact: true }).fill("Haus");
  await page.getByLabel("Определение 1", { exact: true }).fill("дом");
  await page.getByRole("link", { name: "Назад в библиотеку" }).click();
  await expect(page.locator(".draft-row")).toContainText("Meine Reise");
  await page.locator(".draft-row a").click();
  await expect(page.getByLabel("Название колоды")).toHaveValue("Meine Reise");
  await expect(page.getByLabel("Термин 1", { exact: true })).toHaveValue(
    "Haus",
  );
  await page
    .getByRole("button", { name: "Импортировать", exact: true })
    .click();
  await page
    .getByLabel("Данные для импорта")
    .fill("Reise\tпутешествие\nZug\tпоезд");
  await page
    .getByRole("button", { name: "Импортировать 2 карточек", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Жирный термин 1", exact: true })
    .click();
  await expect(
    page.locator('input[type="file"][accept^="image/"]'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Поднять карточку 2", exact: true })
    .click();
  await expect(page.getByLabel("Термин 1", { exact: true })).toHaveValue(
    "Reise",
  );
  await expect(page.getByLabel("Термин 2", { exact: true })).toHaveValue(
    "Haus",
  );
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  await page.reload();
  await expect(page.getByLabel("Термин 2", { exact: true })).toHaveValue(
    "Haus",
  );
  await expect(
    page.getByRole("button", { name: "Жирный термин 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".editor-image img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sets\//);
  await expect(
    page.getByRole("heading", { name: "Meine Reise", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".set-term-row")).toHaveCount(3);
  await expect(page.locator(".set-term-row>strong")).toHaveText([
    "Reise",
    "Haus",
    "Zug",
  ]);
  await expect(page.locator(".set-term-row img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Перевернуть карточку", exact: true })
    .click();
  await expect(page.locator(".set-flip-target strong")).toHaveText(
    "путешествие",
  );
  await page
    .getByRole("button", { name: "Сохранить в избранное", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохранить в избранное", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/library?tab=favorites");
  await expect(page.locator(".quizlet-set-row")).toContainText("Meine Reise");
  await page.getByLabel("Найти карточки").fill("unknown");
  await expect(page.locator(".quizlet-set-row")).toHaveCount(0);
  await page.getByLabel("Найти карточки").fill("Reise");
  await expect(page.locator(".quizlet-set-row")).toHaveCount(1);
  await page.goto("/vocabulary");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  expect(errors).toEqual([]);
});
test("folders contain thematic modules with real decks and combined study queues", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Создать материал", exact: true })
    .click();
  await page.getByRole("link", { name: "Папка", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill("Мой немецкий");
  await expect(page.getByRole("dialog").getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page
    .locator(".collection-card")
    .filter({ hasText: "Мой немецкий" })
    .click();
  await page
    .getByRole("button", { name: "Создать модуль", exact: true })
    .first()
    .click();
  await page.getByLabel("Название", { exact: true }).fill("A1 — начало");
  await page.getByRole("checkbox", { name: /Немецкий на каждый день/ }).check();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page
    .locator(".folder-module-grid .collection-card")
    .filter({ hasText: "A1 — начало" })
    .click();
  await expect(page.locator(".quizlet-set-row")).toContainText(
    "Немецкий на каждый день",
  );
  await page.getByRole("link", { name: "Заучивание", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("все 12 карточек");
});
test("test results and explanations persist after reload", async ({ page }) => {
  await demo(page);
  await page.goto("/learn?mode=test&deck=demo-deck");
  await page.getByLabel("Количество заданий").fill("1");
  await page.getByLabel("Ввести ответ", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Начать тест", exact: true }).click();
  await page.locator(".choice").first().click();
  await page
    .getByRole("button", { name: "Проверить тест", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /правильных ответов/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Сохранённый результат", exact: true })
    .click();
  await expect(page.locator(".saved-test-answers article")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".saved-test-answers article")).toHaveCount(1);
  await page.goto("/solutions?new=1");
  await page.getByLabel("Название", { exact: true }).fill("Порядок слов");
  await page.getByLabel("Условие задачи").fill("Где стоит глагол?");
  await page
    .getByLabel("Решение и объяснение")
    .fill("В обычном предложении глагол стоит на втором месте.");
  await page.getByRole("button", { name: "Сохранить решение" }).click();
  await page.locator(".solution-library a").click();
  await expect(page.locator(".solution-sheet")).toContainText(
    "на втором месте",
  );
  await page.reload();
  await expect(page.locator(".solution-sheet")).toContainText(
    "на втором месте",
  );
});
test("mobile menus, module editor and new pages fit in both themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page.getByRole("link", { name: "Библиотека", exact: true }).click();
  await page.getByRole("button", { name: "Создать материал" }).click();
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Создать карточки", exact: true })
    .click();
  await page.getByLabel("Название колоды").fill("Mobile set");
  await page.getByLabel("Термин 1", { exact: true }).fill("Haus");
  await page.getByLabel("Определение 1", { exact: true }).fill("дом");
  await page.getByLabel("Термин 2", { exact: true }).fill("Baum");
  await page.getByLabel("Определение 2", { exact: true }).fill("дерево");
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/sets\//);
  const setPath = new URL(page.url()).pathname;
  for (const theme of ["dark", "light"]) {
    await page.goto("/settings");
    await page.getByRole("combobox", { name: /^Тема/ }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const route of [
      "/library",
      "/library?tab=folders",
      "/latest",
      setPath,
      "/solutions",
      "/games",
      "/create-set",
    ]) {
      await page.goto(route);
      await expect(page.locator("main")).not.toBeEmpty();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${theme} ${route}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
test("games use module vocabulary and record scores", async ({ page }) => {
  await demo(page);
  await page.goto("/learn?mode=blast&deck=demo-deck");
  await page.getByRole("button", { name: "Начать игру", exact: true }).click();
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
  const prompt = await page.locator(".blast-orbit h2").innerText();
  await page
    .getByRole("button", { name: translations[prompt], exact: true })
    .click();
  await expect(page.locator(".blast-status")).toContainText("100 очков");
  await page.goto("/games");
  await expect(page.locator(".game-tile")).toHaveCount(2);
  await page.getByLabel("Учебный модуль").selectOption("demo-deck");
  await page.locator(".game-match").click();
  await page.getByRole("button", { name: "Начать игру", exact: true }).click();
  await expect(page.locator(".match-tile")).toHaveCount(12);
});
