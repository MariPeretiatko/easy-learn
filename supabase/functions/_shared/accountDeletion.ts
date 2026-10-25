// The job and maintenance lock remain after any failure. A retry or scheduled
// service-role invocation continues from the remaining Storage objects.
export async function completeAccountDeletion(admin: any, owner: string) {
  const request = await admin.rpc("request_account_deletion", {
    target_owner: owner,
  });
  if (request.error) throw request.error;
  try {
    for (;;) {
      const page = await admin.storage
        .from("card-images")
        .list(owner, { limit: 1000 });
      if (page.error) throw page.error;
      if (!page.data?.length) break;
      const removed = await admin.storage
        .from("card-images")
        .remove(
          page.data.map((file: { name: string }) => `${owner}/${file.name}`),
        );
      if (removed.error) throw removed.error;
    }
    const existing = await admin.auth.admin.getUserById(owner);
    if (existing.data?.user) {
      const removed = await admin.auth.admin.deleteUser(owner);
      if (removed.error) throw removed.error;
    } else if (
      existing.error &&
      existing.error.status !== 404 &&
      existing.error.code !== "user_not_found"
    ) {
      throw existing.error;
    }
    const updated = await admin
      .from("account_deletion_jobs")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("owner_id", owner);
    if (updated.error) throw updated.error;
    // Normally cascaded by Auth deletion; also release a leftover lock on retry.
    const released = await admin.rpc("finish_image_cleanup", {
      target_owner: owner,
      cleanup_token: request.data,
    });
    if (released.error) throw released.error;
  } catch (error) {
    await admin
      .from("account_deletion_jobs")
      .update({
        last_error: error instanceof Error ? error.message : "Deletion failed",
      })
      .eq("owner_id", owner);
    throw error;
  }
}
