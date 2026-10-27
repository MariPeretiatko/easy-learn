export function emailInitial(email?: string | null) {
  return Array.from(email?.trim() ?? "")[0]?.toLocaleUpperCase() ?? "?";
}
