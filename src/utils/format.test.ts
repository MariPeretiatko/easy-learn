import { expect, it, vi } from "vitest";
import { uid } from "./format";
it("generates UUIDv4 when randomUUID is unavailable on local HTTP", () => {
  const original = crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: original.getRandomValues.bind(original),
  });
  try {
    const a = uid(),
      b = uid();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a).not.toBe(b);
  } finally {
    vi.unstubAllGlobals();
  }
});
