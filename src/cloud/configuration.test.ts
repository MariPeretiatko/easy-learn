import { expect, it } from "vitest";
import { cloudConfigurationMessage } from "./configuration";
it("distinguishes absent and invalid configuration without disabling valid public keys", () => {
  expect(cloudConfigurationMessage()).toContain("не настроен");
  expect(
    cloudConfigurationMessage(
      "https://example.supabase.co",
      "sb_publishable_test",
    ),
  ).toBe("");
  const jwt = (role: string) =>
    `header.${btoa(JSON.stringify({ role }))}.signature`;
  expect(cloudConfigurationMessage("http://127.0.0.1:54321", jwt("anon"))).toBe(
    "",
  );
  for (const key of [
    "sb_secret_private",
    jwt("service_role"),
    "invalid",
    undefined,
  ])
    expect(
      cloudConfigurationMessage("https://example.supabase.co", key),
    ).toContain("Некорректная");
});
