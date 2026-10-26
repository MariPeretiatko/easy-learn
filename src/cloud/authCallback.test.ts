import { expect, it, vi } from "vitest";
import type { CloudClient } from "./client";
import { completeEmailCallback } from "./authCallback";
function fixture() {
  const auth = {
    setSession: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
  };
  return { auth, client: { auth } as unknown as CloudClient };
}
it("accepts confirmation and recovery links without a local PKCE verifier", async () => {
  const { auth, client } = fixture();
  await expect(
    completeEmailCallback(
      client,
      new URL(
        "https://app.example/auth/callback#access_token=access&refresh_token=refresh&type=recovery",
      ),
    ),
  ).resolves.toEqual({ recovery: true });
  expect(auth.setSession).toHaveBeenCalledWith({
    access_token: "access",
    refresh_token: "refresh",
  });
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  await expect(
    completeEmailCallback(
      client,
      new URL(
        "https://app.example/auth/callback?token_hash=hashed&type=signup",
      ),
    ),
  ).resolves.toEqual({ recovery: false });
  expect(auth.verifyOtp).toHaveBeenCalledWith({
    token_hash: "hashed",
    type: "signup",
  });
});
it("rejects invalid, incomplete and failed email links without marking recovery", async () => {
  const { auth, client } = fixture();
  for (const suffix of [
    "#access_token=access",
    "#error=access_denied",
    "?token_hash=hash&type=unknown",
    "",
  ]) {
    await expect(
      completeEmailCallback(
        client,
        new URL(`https://app.example/auth/callback${suffix}`),
      ),
    ).rejects.toThrow("Ссылка недействительна");
  }
  expect(auth.setSession).not.toHaveBeenCalled();
  auth.setSession.mockResolvedValueOnce({ error: new Error("Expired") });
  await expect(
    completeEmailCallback(
      client,
      new URL(
        "https://app.example/auth/callback#access_token=a&refresh_token=r&type=recovery",
      ),
    ),
  ).rejects.toThrow("Ссылка недействительна");
});
it("supports old PKCE links and explains a missing verifier", async () => {
  const { auth, client } = fixture();
  await expect(
    completeEmailCallback(
      client,
      new URL("https://app.example/auth/callback?code=old"),
    ),
  ).resolves.toEqual({ recovery: false });
  auth.exchangeCodeForSession.mockResolvedValueOnce({
    error: new Error("PKCE code verifier not found"),
  });
  await expect(
    completeEmailCallback(
      client,
      new URL("https://app.example/auth/callback?code=other"),
    ),
  ).rejects.toThrow("запросите новое письмо");
});
