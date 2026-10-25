import type { Database } from "./database.types";
import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function validKey(value: string) {
  if (value.startsWith("sb_secret_")) return false;
  try {
    const payload = JSON.parse(atob(value.split(".")[1] ?? ""));
    return payload.role === "anon";
  } catch {
    return value.startsWith("sb_publishable_");
  }
}
export const cloudConfigurationError =
  !url && !key
    ? "Вход временно недоступен: сервер аккаунтов не настроен."
    : !url || !key || !/^https?:\/\//.test(url) || !validKey(key)
      ? "Некорректная публичная конфигурация Supabase."
      : "";
export const supabase = cloudConfigurationError
  ? null
  : createClient<Database>(url!, key!, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
export function authClient() {
  if (!supabase) throw new Error(cloudConfigurationError);
  return supabase;
}

export type CloudClient = NonNullable<typeof supabase>;
