import { expect, it, vi } from "vitest";
import { completeAccountDeletion } from "../../supabase/functions/_shared/accountDeletion";
it("keeps deletion intent after an Auth failure and resumes without reopening the account", async () => {
  let files = ["a", "b"],
    failAuth = true;
  const updates: unknown[] = [];
  const admin = {
    rpc: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
      data: "lease",
      error: null,
    })),
    storage: {
      from: () => ({
        list: async () => ({
          data: files.map((name) => ({ name })),
          error: null,
        }),
        remove: async () => {
          files = [];
          return { error: null };
        },
      }),
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { id: "owner" } },
          error: null,
        }),
        deleteUser: async () => ({
          error: failAuth ? new Error("Auth unavailable") : null,
        }),
      },
    },
    from: () => ({
      update: (value: unknown) => ({
        eq: async () => {
          updates.push(value);
          return { error: null };
        },
      }),
    }),
  };
  await expect(completeAccountDeletion(admin, "owner")).rejects.toThrow(
    "Auth unavailable",
  );
  expect(files).toEqual([]);
  expect(admin.rpc.mock.calls.flat().includes("finish_image_cleanup")).toBe(
    false,
  );
  expect(updates).toContainEqual({ last_error: "Auth unavailable" });
  failAuth = false;
  await completeAccountDeletion(admin, "owner");
  expect(updates).toContainEqual(
    expect.objectContaining({ status: "complete" }),
  );
});
