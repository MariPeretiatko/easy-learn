const values = new Map<string, string>();
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
  },
  configurable: true,
});
