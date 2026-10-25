export const dataTables = [
  "words",
  "decks",
  "texts",
  "videos",
  "reviews",
  "statistics",
  "recent",
  "drafts",
  "collections",
  "solutions",
  "testResults",
  "preferences",
  "activity",
] as const;
export type DataTable = (typeof dataTables)[number];
export type RecordValue = Record<string, unknown>;
export interface Change {
  resetProgress?: boolean;
  table: DataTable;
  key: string;
  before: RecordValue | null;
  value: RecordValue | null;
}
export interface PendingOperation {
  order: number;
  id: string;
  createdAt: number;
  changes: Change[];
}
export interface RemoteRecord {
  kind: DataTable;
  record_id: string;
  data: RecordValue | null;
  revision: number;
  deleted: boolean;
}
export interface SyncConflict {
  id: string;
  operation: PendingOperation;
  remote: RemoteRecord[];
  createdAt: number;
}
export interface SyncMeta {
  key: string;
  value: unknown;
}
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a == null && b == null;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  const left = Object.keys(a as object).sort(),
    right = Object.keys(b as object).sort();
  return (
    left.length === right.length &&
    left.every(
      (k, i) =>
        k === right[i] && equal((a as RecordValue)[k], (b as RecordValue)[k]),
    )
  );
}
