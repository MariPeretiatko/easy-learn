import { expect, it } from "vitest";
import { safeReturnTo } from "./auth";
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
