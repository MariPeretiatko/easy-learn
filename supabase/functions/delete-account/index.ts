import { completeAccountDeletion } from "../_shared/accountDeletion.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
Deno.serve(
  { port: Number(Deno.env.get("PORT") ?? 8000) },
  async (request: Request) => {
    const origin = request.headers.get("origin") ?? "";
    const allowed = (
      Deno.env.get("ALLOWED_ORIGINS") ??
      "http://127.0.0.1:5173,http://127.0.0.1:4173"
    ).split(",");
    const headers = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Content-Type": "application/json",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST" || (origin && !allowed.includes(origin)))
      return new Response("{}", { status: 403, headers });
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer /i, "");
    if (!token) return new Response("{}", { status: 401, headers });
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    // The scheduler retries pending jobs with the service-role credential.
    if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      const jobs = await admin
        .from("account_deletion_jobs")
        .select("owner_id")
        .eq("status", "pending")
        .order("requested_at")
        .limit(10);
      if (jobs.error) return new Response("{}", { status: 503, headers });
      await admin.rpc("prune_sync_staging");
      let completed = 0;
      for (const job of jobs.data) {
        try {
          await completeAccountDeletion(admin, job.owner_id);
          completed++;
        } catch {
          /* Durable job remains available for the next scheduled retry. */
        }
      }
      return new Response(JSON.stringify({ ok: true, completed }), { headers });
    }
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) return new Response("{}", { status: 401, headers });
    try {
      await completeAccountDeletion(admin, user.id);
      return new Response(JSON.stringify({ ok: true }), { headers });
    } catch {
      const job = await admin
        .from("account_deletion_jobs")
        .select("status")
        .eq("owner_id", user.id)
        .maybeSingle();
      return new Response(
        JSON.stringify({
          ok: false,
          pending: !!job.data,
          error: job.data
            ? "Удаление начато. Аккаунт заблокирован до завершения; повторите удаление."
            : "Не удалось начать удаление. Повторите позже.",
        }),
        { status: 503, headers },
      );
    }
  },
);
