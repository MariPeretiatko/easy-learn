export function cloudConfigurationMessage(url?: string, key?: string) {
  if (!url && !key)
    return "Вход временно недоступен: сервер аккаунтов не настроен.";
  if (!url || !key || !/^https?:\/\//.test(url) || !publicKey(key))
    return "Некорректная публичная конфигурация Supabase.";
  return "";
}
function publicKey(value: string) {
  if (value.startsWith("sb_secret_")) return false;
  try {
    const payload = JSON.parse(atob(value.split(".")[1] ?? ""));
    return payload.role === "anon";
  } catch {
    return value.startsWith("sb_publishable_");
  }
}
