import { expect, it } from "vitest";
import { clearImageRequests, transformImages } from "./images";
import type { CloudClient } from "./client";
it("bounds image uploads during large synchronization batches", async () => {
  clearImageRequests();
  let active = 0,
    maximum = 0,
    calls = 0;
  const client = {
    storage: {
      from: () => ({
        upload: async () => {
          active++;
          calls++;
          maximum = Math.max(maximum, active);
          await new Promise((resolve) => setTimeout(resolve, 2));
          active--;
          return { error: null };
        },
      }),
    },
  } as unknown as CloudClient;
  await transformImages(
    client,
    "owner",
    {
      cards: Array.from({ length: 24 }, (_, i) => ({
        image: `data:image/png;base64,${Buffer.from([i]).toString("base64")}`,
      })),
    },
    "upload",
  );
  expect(calls).toBe(24);
  expect(maximum).toBeLessThanOrEqual(4);
  expect(maximum).toBeGreaterThan(1);
  clearImageRequests();
});
