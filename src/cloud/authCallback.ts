import type { CloudClient } from "./client";
// Email links may be opened in a different browser, where a PKCE verifier is absent.
export async function completeEmailCallback(client: CloudClient, url: URL) {
  const fragment = new URLSearchParams(url.hash.slice(1));
  const params = url.searchParams;
  if (params.has("error") || fragment.has("error"))
    throw new Error(
      "Ссылка недействительна или истекла. Запросите новое письмо.",
    );
  const type = fragment.get("type") ?? params.get("type");
  const recovery = type === "recovery";
  const tokenHash = params.get("token_hash");
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  const code = params.get("code");
  let error;
  if (tokenHash && (type === "signup" || type === "email" || recovery)) {
    ({ error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: recovery ? "recovery" : (type as "signup" | "email"),
    }));
  } else if (accessToken && refreshToken) {
    ({ error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }));
  } else if (code) {
    // Continue to accept links issued before the flow change in the original browser.
    ({ error } = await client.auth.exchangeCodeForSession(code));
    if (error && /verifier|pkce/i.test(error.message))
      throw new Error(
        "Откройте эту старую ссылку в браузере, где запросили письмо, или запросите новое письмо.",
      );
  } else
    throw new Error(
      "Ссылка недействительна или истекла. Запросите новое письмо.",
    );
  if (error)
    throw new Error(
      "Ссылка недействительна или истекла. Запросите новое письмо.",
    );
  return { recovery };
}
