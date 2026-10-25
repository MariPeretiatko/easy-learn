import { expect, it } from "vitest";
import { flushPendingWrites, registerFlush, trackWrite } from "./pendingWrites";
it("flushes active editors and waits for writes still finishing after unmount", async () => {
  let finish!: () => void;
  const write = trackWrite(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  let called = false;
  const unregister = registerFlush(async () => {
    called = true;
    await write;
  });
  const flush = flushPendingWrites();
  expect(called).toBe(true);
  unregister();
  finish();
  await flush;
  await flushPendingWrites();
});
