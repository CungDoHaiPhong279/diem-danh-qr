import { connection } from "next/server";
import { admin } from "@/lib/supabase/admin";

// `dynamic = 'force-dynamic'` is removed under cacheComponents; connection() makes this request-time.
export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  const { error } = await admin.from("events").select("id").limit(1);
  return error ? Response.json({ ok: false }, { status: 503, headers }) : Response.json({ ok: true }, { headers });
}
