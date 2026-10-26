import { test, expect } from "@playwright/test";
test("signed-out visitors see standalone account screens and cannot open a personal workspace", async ({
  page,
}) => {
  for (const path of ["/", "/library", "/settings", "/create-set"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(
      page.getByRole("heading", { name: "Войти", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".topbar,.study-sidebar,.profile-dropdown"),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /библиотека/i })).toHaveCount(
      0,
    );
  }
  await page.getByRole("link", { name: "Создать аккаунт" }).click();
  await expect(
    page.getByRole("heading", { name: "Регистрация", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Имя", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Повторите пароль")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Уже есть аккаунт? Войти" }).click();
  await expect(page).toHaveURL(/next=%2Fcreate-set/);
});

test("forms contain only the requested fields and support password visibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 940 });
  await page.goto("/login?next=%2Flibrary");
  await expect(page.locator(".auth-visual")).toBeVisible();
  await expect(page.locator("form input:visible")).toHaveCount(2);
  await expect(page.locator('form input[type="checkbox"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Google|Facebook|Apple|WhatsApp/i }),
  ).toHaveCount(0);
  const password = page.getByLabel("Пароль", { exact: true });
  await password.fill("sample-password");
  await page
    .getByRole("button", { name: "Показать пароль", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("sample-password");
  await page
    .getByRole("button", { name: "Скрыть пароль", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("link", { name: "Регистрация", exact: true }).click();
  await expect(page.locator("form input:visible")).toHaveCount(3);
  await expect(page.getByLabel("Имя", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Показать пароль", exact: true })
    .click();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(
    page.getByLabel("Повторите пароль", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Уже есть аккаунт? Войти", exact: true })
    .click();
  await expect(page).toHaveURL(/next=%2Flibrary/);
  await page.getByRole("link", { name: "Забыли пароль?", exact: true }).click();
  await expect(page.locator("form input:visible")).toHaveCount(1);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`switching account forms preserves layout and entered values at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login?next=%2Flibrary");
    await page.locator(".auth-tabs").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const positions = () =>
      page.evaluate(() =>
        [".auth-card", ".auth-tabs", ".auth-primary", ".auth-alternative"].map(
          (selector) => {
            const box = document
              .querySelector(selector)!
              .getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          },
        ),
      );
    const initial = await positions();
    await page.getByLabel("Email", { exact: true }).fill("learner@example.com");
    await page.getByRole("link", { name: "Регистрация", exact: true }).click();
    await page.getByLabel("Имя", { exact: true }).fill("Ученик");
    await page
      .locator(".auth-name-slot")
      .evaluate((element) =>
        Promise.all(
          element
            .getAnimations()
            .map((animation) => animation.finished.catch(() => undefined)),
        ),
      );
    await expect(page.getByLabel("Повторите пароль")).toHaveCount(0);
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "learner@example.com",
    );
    expect(await positions()).toEqual(initial);
    await page.getByRole("link", { name: "Вход", exact: true }).click();
    await page
      .locator(".auth-name-slot")
      .evaluate((element) =>
        Promise.all(
          element
            .getAnimations()
            .map((animation) => animation.finished.catch(() => undefined)),
        ),
      );
    await expect(page.getByLabel("Имя", { exact: true })).toBeDisabled();
    await expect(page.locator("form input:visible")).toHaveCount(2);
    expect(await positions()).toEqual(initial);
    await page.getByRole("link", { name: "Регистрация", exact: true }).click();
    await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Ученик");
  });
}

test("account switching respects reduced-motion preference", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByRole("link", { name: "Регистрация", exact: true }).click();
  await expect(page.getByLabel("Имя", { exact: true })).toBeVisible();
  expect(
    await page
      .locator(".auth-tabs-indicator")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  await expect(page.locator("form input:visible")).toHaveCount(3);
});

test("registration distinguishes email delivery errors from connection failures", async ({
  page,
}) => {
  await page.route("**/auth/v1/signup**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "unexpected_failure",
        msg: "Error sending confirmation email",
      }),
    }),
  );
  await page.goto("/register");
  await page.getByLabel("Имя", { exact: true }).fill("Ученик");
  await page.getByLabel("Email", { exact: true }).fill("learner@example.com");
  await page.getByLabel("Пароль", { exact: true }).fill("Example-pass-123!");
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Сервис отправки писем временно недоступен",
  );
});

test("callback removes failed email credentials from history and explains the error", async ({
  page,
}) => {
  await page.goto(
    "/auth/callback#error=access_denied&error_description=Expired",
  );
  await expect(page.getByRole("alert")).toContainText("Ссылка недействительна");
  expect(new URL(page.url()).hash).toBe("");
});

test("a recovery email opens in a fresh browser without a PKCE verifier", async ({
  page,
}) => {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "learner@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    }),
  );
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.${encode("signature")}`;
  await page.goto(
    `/auth/callback#access_token=${token}&refresh_token=test-refresh-token&type=recovery`,
  );
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(
    page.getByRole("heading", { name: "Новый пароль", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Новый пароль", exact: true }),
  ).toBeEnabled();
  expect(new URL(page.url()).hash).toBe("");
});
