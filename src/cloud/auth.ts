import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";
export const useAccount = create<{
  user: User | null;
  ready: boolean;
  generation: number;
  recovery: boolean;
  error: string;
}>(() => ({
  user: null,
  ready: false,
  generation: 0,
  recovery: false,
  error: "",
}));
export function safeReturnTo(value: string | null) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\u0000-\u0020]/.test(value) &&
    !/^\/(login|register|auth|reset-password|forgot-password)(\/|\?|$)/.test(
      value,
    )
    ? value
    : "/library";
}
export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
export function observeAuth() {
  if (!supabase) {
    useAccount.setState({ ready: true });
    return () => undefined;
  }
  let received = false,
    stopped = false;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (stopped) return;
    received = true;
    const old = useAccount.getState();
    useAccount.setState({
      user: session?.user ?? null,
      ready: true,
      generation: old.generation + Number(old.user?.id !== session?.user.id),
      recovery:
        event === "PASSWORD_RECOVERY" ||
        (event !== "SIGNED_OUT" && old.recovery),
      error: "",
    });
  });
  void supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (!stopped && !received)
        useAccount.setState({
          user: data.session?.user ?? null,
          ready: true,
          error: error
            ? "Не удалось восстановить сессию. Попробуйте войти снова."
            : "",
        });
    })
    .catch(() => {
      if (!stopped && !received)
        useAccount.setState({
          ready: true,
          error: "Не удалось восстановить сессию",
        });
    });
  return () => {
    stopped = true;
    data.subscription.unsubscribe();
  };
}
export function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "invalid_credentials") return "Неверный email или пароль.";
  if (code === "email_not_confirmed") return "Сначала подтвердите адрес почты.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  )
    return "Слишком много попыток. Подождите перед повторной отправкой.";
  if (code === "weak_password")
    return "Пароль не соответствует требованиям безопасности.";
  return "Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.";
}
