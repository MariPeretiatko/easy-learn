import { expect, it } from "vitest";
import { emailInitial } from "./profile";
it("uses the first email character and a neutral fallback instead of saved avatars", () => {
  expect(emailInitial("mariaperetatko7@gmail.com")).toBe("M");
  expect(emailInitial("  anna@example.com ")).toBe("A");
  expect(emailInitial("я@example.com")).toBe("Я");
  expect(emailInitial()).toBe("?");
  expect(emailInitial("")).toBe("?");
});
