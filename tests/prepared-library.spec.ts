import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("the German library has level folders, thematic modules and no tiny decks", async ({
  page,
}) => {
  await page.goto("/library?tab=folders");
  await expect(page.locator(".collection-card")).toHaveCount(3);
  for (const level of ["A1", "A2", "B1"])
    await expect(
      page.getByRole("heading", { name: level, exact: true }),
    ).toBeVisible();
  await page
    .locator(".collection-card")
    .filter({ has: page.getByRole("heading", { name: "A1", exact: true }) })
    .click();
  await expect(
    page.locator(".folder-module-grid .collection-card"),
  ).toHaveCount(11);
  await expect(page.locator(".quizlet-set-list .quizlet-set-row")).toHaveCount(
    0,
  );
  await page
    .locator(".folder-module-grid .collection-card")
    .filter({ hasText: "Еда и покупки" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Еда и покупки", exact: true }),
  ).toBeVisible();
  const sizes = await page.locator(".set-row-meta").allTextContents();
  expect(sizes.length).toBeGreaterThan(1);
  expect(sizes.every((size) => Number.parseInt(size, 10) >= 10)).toBeTruthy();
  const firstLink = page.locator(".quizlet-set-list .quizlet-set-row").first();
  const deckId = (await firstLink.getAttribute("href"))!.split("/").pop()!;
  await page.evaluate(async (id) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("easy-learn");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction("decks", "readwrite");
        const store = tx.objectStore("decks");
        const deck = store.get(id);
        deck.onsuccess = () =>
          store.put({ ...deck.result, title: "Моя изменённая колода" });
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => {
          database.close();
          reject(tx.error);
        };
      };
    });
  }, deckId);
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Моя изменённая колода/ }),
  ).toBeVisible();
});

test("an existing imported library is reorganized on reload without resetting progress", async ({
  page,
}) => {
  const { newWord } = await import("../src/services/wordModel");
  const { default: original } = await import("../src/data/deutsch-a1-b1.json", {
    with: { type: "json" },
  });
  let number = 0;
  const words: ReturnType<typeof newWord>[] = [];
  const decks = original.folders.flatMap((folder) =>
    folder.modules.flatMap((module) =>
      module.decks.map((deck) => ({
        id: deck.id,
        title: deck.title,
        description: "",
        language: "de",
        tags: [],
        favorite: false,
        createdAt: 1,
        updatedAt: 1,
        wordIds: deck.cards.map((card) => {
          const word = newWord({ ...card, id: `legacy-word-${number++}` });
          words.push(word);
          return word.id;
        }),
      })),
    ),
  );
  words[0].reviewCount = 7;
  words[0].notes = "Моя заметка до переноса";
  const collections = original.folders.flatMap((folder) => [
    {
      id: folder.id,
      title: folder.title,
      kind: "folder",
      description: "",
      createdAt: 1,
      updatedAt: 1,
      deckIds: folder.modules.flatMap((module) =>
        module.decks.map((deck) => deck.id),
      ),
    },
    ...folder.modules.map((module) => ({
      id: module.id,
      title: module.title,
      kind: "course",
      language: "de",
      description: "",
      createdAt: 1,
      updatedAt: 1,
      deckIds: module.decks.map((deck) => deck.id),
    })),
  ]);
  await page.goto("/library");
  await page
    .getByRole("heading", { name: "Ваша библиотека", exact: true })
    .waitFor();
  await page.evaluate(
    async (records) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("easy-learn");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction(
            ["words", "decks", "collections"],
            "readwrite",
          );
          for (const name of ["words", "decks", "collections"] as const) {
            const store = tx.objectStore(name);
            store.clear();
            for (const value of records[name]) store.put(value);
          }
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => {
            database.close();
            reject(tx.error);
          };
        };
      });
      localStorage.setItem("easy-learn-import-deutsch-a1-a2-b1-ru-v1", "done");
      localStorage.removeItem("easy-learn-import-deutsch-a1-a2-b1-ru-v2");
    },
    { words, decks, collections },
  );
  await page.goto("/library?tab=folders");
  await expect(page.locator(".collection-card")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "A1", exact: true }),
  ).toBeVisible();
  const progress = await page.evaluate(
    async () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = indexedDB.open("easy-learn");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction("words", "readonly");
          const word = tx.objectStore("words").get("legacy-word-0");
          word.onsuccess = () => {
            resolve(word.result);
            database.close();
          };
        };
      }),
  );
  expect(progress.reviewCount).toBe(7);
  expect(progress.notes).toBe("Моя заметка до переноса");
  await page.reload();
  await expect(page.locator(".collection-card")).toHaveCount(3);
});
