/**
 * Local-PostgreSQL mode: the small part of the supabase-js API the billing screens
 * use, sent to /api/db and /api/auth on this Next.js server.
 */
import type { Filter, QuerySpec } from "@/lib/localdb/server";

type ApiError = { message: string; code: string };
type Result = { data: unknown; error: ApiError | null; count?: number | null };

async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    // A 401 (session expired) comes back as an error; the proxy sends the next page load to the login screen.
    return await res.json().catch(() => ({ data: null, error: { message: "Unexpected server response", code: String(res.status) } }));
  } catch {
    return { data: null, error: { message: "Failed to fetch", code: "network" } };
  }
}

class Query implements PromiseLike<Result> {
  private spec: QuerySpec;
  constructor(table: string) { this.spec = { action: "select", table, filters: [], orders: [], mode: "many" }; }

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    if (this.spec.action !== "select") this.spec.returning = true;
    this.spec.columns = columns;
    if (options?.head) this.spec.head = true;
    return this;
  }
  insert(row: Record<string, unknown>) { this.spec.action = "insert"; this.spec.payload = row; return this; }
  update(row: Record<string, unknown>) { this.spec.action = "update"; this.spec.payload = row; return this; }
  private filter(op: Filter["op"], col: string | undefined, value: unknown) { this.spec.filters!.push({ op, col, value }); return this; }
  eq(col: string, v: unknown) { return this.filter("eq", col, v); }
  gt(col: string, v: unknown) { return this.filter("gt", col, v); }
  gte(col: string, v: unknown) { return this.filter("gte", col, v); }
  lte(col: string, v: unknown) { return this.filter("lte", col, v); }
  in(col: string, v: unknown[]) { return this.filter("in", col, v); }
  or(expr: string) { return this.filter("or", undefined, expr); }
  order(col: string, options?: { ascending?: boolean }) { this.spec.orders!.push({ col, asc: options?.ascending ?? true }); return this; }
  limit(n: number) { this.spec.limit = n; return this; }
  single() { this.spec.mode = "single"; return this; }
  maybeSingle() { this.spec.mode = "maybe"; return this; }

  then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return post("/api/db", { query: this.spec }).then((r) => r as unknown as Result).then(onfulfilled, onrejected);
  }
}

export function createLocalClient() {
  return {
    from: (table: string) => new Query(table),
    rpc: (name: string, args: Record<string, unknown> = {}) => post("/api/db", { rpc: name, args }) as Promise<Result>,
    auth: {
      getUser: async () => {
        const r = await post("/api/auth", { action: "getUser" });
        return { data: { user: (r.user as { id: string; email: string } | null) ?? null }, error: r.error ?? null };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const r = await post("/api/auth", { action: "signIn", email, password });
        return { data: { user: r.user ?? null }, error: (r.error as ApiError | null) ?? null };
      },
      signOut: async () => { await post("/api/auth", { action: "signOut" }); return { error: null }; },
      resetPasswordForEmail: async () => ({ data: {}, error: { message: "Ask the administrator to reset the password (npm run db:password).", code: "local" } }),
      updateUser: async () => ({ data: {}, error: { message: "Not available in local mode", code: "local" } }),
    },
  };
}
