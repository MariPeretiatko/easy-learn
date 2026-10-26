import { clearDraftJournal } from "./draftRecovery";
import { db } from "../db/database";
import type { SetDraft } from "../types";
export const DraftRepository = {
  get: (id: string) => db.drafts.get(id),
  save: (draft: SetDraft) => db.drafts.put(draft),
  delete: async (id: string) => {
    const owner = db.owner;
    await db.drafts.delete(id);
    clearDraftJournal(owner, id);
  },
};
