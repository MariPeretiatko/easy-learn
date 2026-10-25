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
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) return new Response("{}", { status: 401, headers });
    const lease = await admin.rpc("begin_image_cleanup", {
      target_owner: user.id,
    });
    if (lease.error)
      return new Response(
        JSON.stringify({
          error: "Очистка уже выполняется или требует восстановления",
        }),
        { status: 409, headers },
      );
    try {
      const used = new Set<string>();
      function collect(value: unknown) {
        if (typeof value === "string" && value.startsWith("storage://"))
          used.add(value.slice(10));
        else if (Array.isArray(value)) for (const item of value) collect(item);
        else if (value && typeof value === "object")
          for (const item of Object.values(value)) collect(item);
      }
      for (let offset = 0; ; offset += 500) {
        const page = await admin
          .from("sync_records")
          .select("data")
          .eq("owner_id", user.id)
          .eq("deleted", false)
          .order("kind")
          .order("record_id")
          .range(offset, offset + 499);
        if (page.error) throw page.error;
        for (const row of page.data) collect(row.data);
        if (page.data.length < 500) break;
      }
      // Resumable imports may already reference uploaded files before committing.
      for (let offset = 0; ; offset += 500) {
        const page = await admin
          .from("sync_staging")
          .select("changes")
          .eq("owner_id", user.id)
          .order("operation_id")
          .order("part_no")
          .range(offset, offset + 499);
        if (page.error) throw page.error;
        for (const row of page.data) collect(row.changes);
        if (page.data.length < 500) break;
      }
      const removable: string[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await admin.storage
          .from("card-images")
          .list(user.id, {
            limit: 500,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
        if (page.error) throw page.error;
        for (const file of page.data) {
          const path = `${user.id}/${file.name}`;
          if (
            !used.has(path) &&
            file.created_at &&
            Date.now() - Date.parse(file.created_at) > 7 * 86400000
          )
            removable.push(path);
        }
        if (page.data.length < 500) break;
      }
      for (let offset = 0; offset < removable.length; offset += 100) {
        const result = await admin.storage
          .from("card-images")
          .remove(removable.slice(offset, offset + 100));
        if (result.error) throw result.error;
      }
      return new Response(
        JSON.stringify({ ok: true, removed: removable.length }),
        { headers },
      );
    } catch {
      return new Response(
        JSON.stringify({
          error: "Очистка не завершена. Данные библиотеки сохранены.",
        }),
        { status: 503, headers },
      );
    } finally {
      await admin.rpc("finish_image_cleanup", {
        target_owner: user.id,
        cleanup_token: lease.data,
      });
    }
  },
);
