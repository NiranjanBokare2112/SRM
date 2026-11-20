import { cookies } from "next/headers";
import { runFunction, runQuery, toClientError, type QuerySpec } from "@/lib/localdb/server";
import { SESSION_COOKIE, verifySession } from "@/lib/localdb/session";

/** Local-PostgreSQL mode: executes one query or function call for the signed-in user. */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DB_MODE !== "local") return Response.json({ message: "Not found" }, { status: 404 });

  const userId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return Response.json({ error: { message: "Please sign in again.", code: "401" } }, { status: 401 });

  let body: { rpc?: string; args?: Record<string, unknown>; query?: QuerySpec };
  try { body = await request.json(); } catch { return Response.json({ error: { message: "Bad request", code: "400" } }, { status: 400 }); }

  try {
    const result = body.rpc ? await runFunction(userId, body.rpc, body.args) : await runQuery(userId, body.query as QuerySpec);
    return Response.json({ ...result, error: null });
  } catch (error) {
    const { status, body: err } = toClientError(error);
    return Response.json({ data: null, error: err }, { status });
  }
}
