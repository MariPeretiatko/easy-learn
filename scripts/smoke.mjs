import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("net::ERR"))
    errors.push(message.text());
});
const routes = (process.argv[2] ?? "/,/settings").split(",");
for (const route of routes) {
  await page.goto(`http://127.0.0.1:5173${route}`);
  await page.waitForTimeout(450);
  if (!(await page.locator("main").innerText()).trim())
    throw new Error(`Empty page: ${route}`);
}
await page.goto("http://127.0.0.1:5173");
await mkdir("artifacts", { recursive: true });
await page.screenshot({ path: "artifacts/dashboard.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
await browser.close();
if (errors.length || overflow)
  throw new Error(JSON.stringify({ errors, overflow }));
console.log(
  `Browser smoke passed: ${routes.join(", ")}; desktop/mobile, no console errors.`,
);
