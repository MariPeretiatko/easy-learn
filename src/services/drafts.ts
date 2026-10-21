import { db } from "../db/database";
import type { SetDraft } from "../types";
export const DraftRepository = {
  get: (id: string) => db.drafts.get(id),
  save: (draft: SetDraft) => db.drafts.put(draft),
  delete: (id: string) => db.drafts.delete(id),
};
