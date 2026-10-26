// Legacy card media is discarded without accessing Storage. Text stays unchanged.
export function withoutCardImages<T>(value: T): T {
  if (Array.isArray(value)) {
    const clean = value.map(withoutCardImages);
    return clean.some((item, index) => item !== value[index])
      ? (clean as T)
      : value;
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    let clean: Record<string, unknown> | undefined;
    for (const [key, item] of Object.entries(source)) {
      if (key === "image" || key === "termImage") {
        clean ??= { ...source };
        delete clean[key];
      } else {
        const next = withoutCardImages(item);
        if (next !== item) {
          clean ??= { ...source };
          clean[key] = next;
        }
      }
    }
    return clean ? (clean as T) : value;
  }
  return value;
}
