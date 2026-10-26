import { cloudConfigurationMessage } from "./configuration";
import type { Database } from "./database.types";
import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const cloudConfigurationError = cloudConfigurationMessage(url, key);
export const supabase = cloudConfigurationError
  ? null
  : createClient<Database>(url!, key!, {
      auth: {
        flowType: "implicit",
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
