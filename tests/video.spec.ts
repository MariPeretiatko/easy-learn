import { test, expect } from "@playwright/test";
test("video transcript, playback controls, source words, looping and dictation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakePlayer {
      position: number;
      duration = 90;
      state = -1;
      rate = 1;
      updated = Date.now();
      events: {
        onReady: () => void;
        onStateChange: (e: { data: number }) => void;
      };
      constructor(
        element: HTMLElement,
        options: {
          playerVars: { start: number };
          events: FakePlayer["events"];
        },
      ) {
        this.position = options.playerVars.start;
        this.events = options.events;
        element.textContent = "YouTube test adapter";
        (window as unknown as { testYT: FakePlayer }).testYT = this;
        setTimeout(() => this.events.onReady(), 20);
      }
      getCurrentTime() {
        if (this.state === 1) {
          this.position += ((Date.now() - this.updated) / 1000) * this.rate;
          this.updated = Date.now();
        }
        return this.position;
      }
      playVideo() {
        this.updated = Date.now();
        this.state = 1;
        this.events.onStateChange({ data: 1 });
      }
      pauseVideo() {
        this.getCurrentTime();
        this.state = 2;
        this.events.onStateChange({ data: 2 });
      }
      seekTo(value: number) {
        this.position = value;
        this.updated = Date.now();
      }
      getDuration() {
        return this.duration;
      }
      getPlayerState() {
        return this.state;
      }
      setPlaybackRate(rate: number) {
        this.rate = rate;
      }
      getAvailablePlaybackRates() {
        return [0.5, 1, 1.5, 2];
      }
      destroy() {}
    }
    (window as unknown as { YT: { Player: typeof FakePlayer } }).YT = {
      Player: FakePlayer,
    };
  });
  await page.goto("/videos?add=1");
  await page.getByLabel("Ссылка YouTube").fill("https://youtu.be/M7lc1UVf-VE");
  await page.getByLabel("Название", { exact: true }).fill("Test clip");
  await page.getByLabel("Субтитры SRT, VTT или JSON").fill(
    JSON.stringify([
      { start: 0, end: 2, text: "Hallo Welt", translation: "Привет мир" },
      {
        start: 2,
        end: 5,
        text: "Wir lernen Deutsch",
        translation: "Мы учим немецкий",
      },
    ]),
  );
  await page.getByRole("button", { name: "Сохранить видео" }).click();
  await page.getByRole("heading", { name: "Test clip" }).click();
  await expect(
    page.getByRole("button", { name: "Воспроизвести или пауза" }),
  ).toBeEnabled();
  await page.getByLabel("Скорость видео").selectOption("1.5");
  expect(
    await page.evaluate(
      () => (window as unknown as { testYT: { rate: number } }).testYT.rate,
    ),
  ).toBe(1.5);
  await page.getByLabel("Скорость видео").selectOption("1");
  await page.getByRole("button", { name: "Вперёд на 5 секунд" }).click();
  await expect(page.locator(".player-controls")).toContainText("0:05");
  await page.getByRole("button", { name: "0:00", exact: true }).click();
  await expect(page.locator(".subtitle-row.active")).toContainText("Hallo");
  await page.getByRole("button", { name: "Hallo", exact: true }).click();
  await page.getByLabel("Перевод", { exact: true }).fill("привет");
  await page.getByRole("button", { name: "В словарь", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hallo", exact: true }),
  ).toHaveClass(/new/);
  await page.getByLabel("Вид субтитров").selectOption("both");
  await expect(page.getByText("Привет мир", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Аудирование и диктант" }).click();
  await page.getByLabel("Повторить", { exact: false }).selectOption("3");
  await page.getByRole("button", { name: "Слушать фразу" }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { testYT: { state: number } }).testYT.state,
        ),
      { timeout: 10000 },
    )
    .toBe(2);
  await page.getByLabel("Что вы услышали?").fill("Hallo");
  await page.getByRole("button", { name: "Проверить диктант" }).click();
  await expect(page.getByText("Точность: 50%", { exact: false })).toBeVisible();
  await expect(page.locator(".dictation-result .missing")).toHaveText("Welt");
  await page.getByRole("button", { name: "Следующая", exact: false }).click();
  await page.getByRole("button", { name: "Показать оригинал" }).click();
  await expect(page.locator(".listening-sentence")).toHaveText(
    "Wir lernen Deutsch",
  );
  await page.goto("/decks");
  await page.getByRole("link", { name: "Test clip", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("hallo");
});
