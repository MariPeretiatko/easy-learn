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
  await expect(page.getByLabel("Повторите пароль")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Уже есть аккаунт? Войти" }).click();
  await expect(page).toHaveURL(/next=%2Fcreate-set/);
});
