import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.addInitScript(() => {
    localStorage.setItem("easy-learn-import-deutsch-a1-a2-b1-ru-v1", "done");
    localStorage.setItem("easy-learn-import-deutsch-a1-a2-b1-ru-v2", "done");
  });
  await mkdir("artifacts/preview", { recursive: true });
  await page.goto(`${base}/library`);
  await page
    .getByRole("button", { name: "Попробовать на примере", exact: true })
    .click();
  await page
    .getByText("Учебная коллекция добавлена", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Скрыть уведомление", exact: true })
    .click();
  for (const [name, route] of [
    ["home", "/"],
    ["library", "/library"],
    ["set", "/sets/demo-deck"],
    ["reader", "/reader/demo-text"],
    ["settings", "/settings"],
  ]) {
    await page.goto(base + route);
    await page.locator("main h1").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `artifacts/preview/${name}-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.goto(`${base}/create-set`);
  await page.getByLabel("Название колоды").fill("Основы A1");
  await page.getByLabel("Термин 1", { exact: true }).fill("Haus");
  await page.getByLabel("Определение 1", { exact: true }).fill("дом");
  await page.getByLabel("Термин 2", { exact: true }).fill("Baum");
  await page.getByLabel("Определение 2", { exact: true }).fill("дерево");
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  await page.screenshot({
    path: "artifacts/preview/editor-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/preview/editor-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Как вы хотите заниматься?", exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/preview/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log("Saved isolated desktop/mobile previews to artifacts/preview/.");
} finally {
  await browser.close();
}
