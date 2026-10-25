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
        JSON.stringify({ error: "Идёт обслуживание файлов. Повторите позже." }),
        { status: 409, headers },
      );
    try {
      const { data: entries, error: listError } = await admin.storage
        .from("card-images")
        .list(user.id, { limit: 1000 });
      if (listError)
        return new Response(
          JSON.stringify({ error: "Не удалось прочитать файлы" }),
          { status: 503, headers },
        );
      let files = entries;
      while (files?.length) {
        const { error } = await admin.storage
          .from("card-images")
          .remove(files.map((file) => `${user.id}/${file.name}`));
        if (error)
          return new Response(
            JSON.stringify({ error: "Не удалось удалить файлы" }),
            { status: 503, headers },
          );
        const next = await admin.storage
          .from("card-images")
          .list(user.id, { limit: 1000 });
        if (next.error) return new Response("{}", { status: 503, headers });
        files = next.data;
      }
      const removed = await admin.auth.admin.deleteUser(user.id);
      return new Response(JSON.stringify({ ok: !removed.error }), {
        status: removed.error ? 503 : 200,
        headers,
      });
    } finally {
      await admin.rpc("finish_image_cleanup", {
        target_owner: user.id,
        cleanup_token: lease.data,
      });
    }
  },
);
