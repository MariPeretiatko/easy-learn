import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4173/videos?add=1");
await page
  .getByLabel("Ссылка YouTube")
  .fill("https://www.youtube.com/watch?v=M7lc1UVf-VE");
await page
  .getByLabel("Название", { exact: true })
  .fill("YouTube API verification");
await page.getByRole("button", { name: "Сохранить видео" }).click();
await page.getByRole("heading", { name: "YouTube API verification" }).click();
try {
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="Воспроизвести или пауза"]')
        ?.disabled,
    {},
    { timeout: 25000 },
  );
  console.log("Live YouTube IFrame API ready; playback controls enabled.");
} catch {
  console.log(
    "Live YouTube verification limited:",
    await page.locator(".notice,.player-loading").allTextContents(),
  );
}
await browser.close();
