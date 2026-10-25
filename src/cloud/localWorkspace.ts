// Explicit standalone mode for local development and isolated browser tests.
// Public builds require an account, even when cloud configuration is missing.
export const localWorkspaceEnabled =
  import.meta.env.VITE_ENABLE_LOCAL_WORKSPACE === "true" &&
  !import.meta.env.VITE_SUPABASE_URL;
