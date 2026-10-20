import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173";
await mkdir("artifacts", { recursive: true });
await page.goto(base);
await page.getByRole("button", { name: "Попробовать на примере" }).click();
await page.getByText("Учебная коллекция добавлена", { exact: true }).waitFor();
await page.goto(base + "/reader/demo-text");
await page.getByRole("button", { name: "Прочитано", exact: true }).waitFor();
await page.screenshot({ path: "artifacts/reader.png", fullPage: true });
await page.goto(base + "/decks/demo-deck");
await page.getByRole("link", { name: "Карточки", exact: true }).click();
await page.getByRole("button", { name: "Перевернуть карточку" }).click();
await page.getByRole("button", { name: /Хорошо/ }).click();
await page.waitForFunction(() =>
  document.querySelector(".session-bar")?.textContent?.includes("2"),
);
await page.goto(base);
await page.locator(".hero").waitFor();
await page.screenshot({ path: "artifacts/dashboard.png", fullPage: true });
await page.screenshot({ path: "artifacts/quizlet-home.png", fullPage: false });
await page.goto(base + "/vocabulary");
await page.locator("tbody tr").first().waitFor();
await page.screenshot({ path: "artifacts/vocabulary.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base);
await page.locator(".hero").waitFor();
await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
await browser.close();
console.log("Saved desktop, vocabulary, reader and mobile screenshots.");
