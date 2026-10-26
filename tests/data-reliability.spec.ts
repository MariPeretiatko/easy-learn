import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newWord } from "../src/services/wordModel";
test("the settings screen accepts its own backup above 20 MB", async ({
  page,
}) => {
  await page.goto("/settings");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const backup = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  backup.words = Array.from({ length: 5 }, (_, i) =>
    newWord({
      id: `large-${i}`,
      term: `Large ${i}`,
      translation: `Большой ${i}`,
      image: `data:image/png;base64,${"A".repeat(4 * 1024 * 1024)}`,
    }),
  );
  const buffer = Buffer.from(JSON.stringify(backup));
  expect(buffer.byteLength).toBeGreaterThan(20_000_000);
  await page.getByLabel("Восстановить из JSON").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(
    page.getByRole("dialog", { name: "Восстановить резервную копию?" }),
  ).toContainText("5 слов");
});
test("all search results are reachable after the first fifty", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Экспорт JSON", exact: true })
    .waitFor();
  const words = Array.from({ length: 101 }, (_, i) =>
    newWord({
      id: `search-${i}`,
      term: `сверхслово ${i}`,
      translation: `word ${i}`,
    }),
  );
  await page.evaluate(async (words) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("easy-learn");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const tx = database.transaction("words", "readwrite");
        for (const word of words) tx.objectStore("words").put(word);
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, words);
  await page.goto("/search?q=сверхслово");
  const rows = page.locator(".search-results .continue-row");
  await expect(rows).toHaveCount(50);
  await page.getByRole("button", { name: /Показать ещё: слова/ }).click();
  await expect(rows).toHaveCount(100);
  await page.getByRole("button", { name: /Показать ещё: слова/ }).click();
  await expect(rows).toHaveCount(101);
});
