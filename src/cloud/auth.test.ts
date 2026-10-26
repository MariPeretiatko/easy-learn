import { expect, it } from "vitest";
import { authError, safeReturnTo } from "./auth";
it("only permits internal return destinations", () => {
  expect(safeReturnTo("/sets/one?mode=learn")).toBe("/sets/one?mode=learn");
  for (const value of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/login",
    "/auth/callback",
    "/\nexample.com",
    null,
  ])
    expect(safeReturnTo(value)).toBe("/library");
});

it("distinguishes email service failures from connection and credential errors", () => {
  expect(
    authError({
      code: "unexpected_failure",
      message: "Error sending confirmation email",
    }),
  ).toContain("Сервис отправки писем");
  expect(authError({ message: "Error sending recovery email" })).toContain(
    "Сервис отправки писем",
  );
  expect(authError({ code: "email_address_not_authorized" })).toContain(
    "владельцу сайта",
  );
  expect(authError({ code: "invalid_credentials" })).toBe(
    "Неверный email или пароль.",
  );
  expect(authError({ message: "Failed to fetch" })).toContain(
    "Проверьте соединение",
  );
});
