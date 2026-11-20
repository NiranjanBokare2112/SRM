import { cookies } from "next/headers";
import { getUserById, verifyPassword } from "@/lib/localdb/server";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "@/lib/localdb/session";

/** Local-PostgreSQL mode: sign in, sign out, and "who am I". */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DB_MODE !== "local") return Response.json({ message: "Not found" }, { status: 404 });
  const jar = await cookies();
  const body = (await request.json().catch(() => ({}))) as { action?: string; email?: string; password?: string };

  try {
    if (body.action === "signIn") {
      // Small fixed delay slows down password guessing.
      await new Promise((r) => setTimeout(r, 400));
      const user = await verifyPassword(String(body.email ?? ""), String(body.password ?? ""));
      if (!user) return Response.json({ user: null, error: { message: "Invalid login credentials", code: "invalid_credentials" } }, { status: 401 });
      jar.set(SESSION_COOKIE, await signSession(user.id), {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86_400,
        secure: process.env.NODE_ENV === "production",
      });
      return Response.json({ user, error: null });
    }
    if (body.action === "signOut") {
      jar.delete(SESSION_COOKIE);
      return Response.json({ error: null });
    }
    const userId = await verifySession(jar.get(SESSION_COOKIE)?.value);
    const user = userId ? await getUserById(userId) : null;
    return Response.json({ user, error: null });
  } catch (error) {
    console.error("[auth]", error);
    return Response.json({ user: null, error: { message: "Could not reach the database. Is PostgreSQL running?", code: "db" } }, { status: 500 });
  }
}
