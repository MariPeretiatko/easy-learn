const flushers = new Set<() => Promise<unknown>>();
const pending = new Set<Promise<unknown>>();
export function trackWrite<T>(write: Promise<T>): Promise<T> {
  pending.add(write);
  void write.then(
    () => pending.delete(write),
    () => pending.delete(write),
  );
  return write;
}
export function registerFlush(flush: () => Promise<unknown>) {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}
export async function flushPendingWrites() {
  await Promise.all([...flushers].map((flush) => flush()));
  await Promise.all([...pending]);
}
