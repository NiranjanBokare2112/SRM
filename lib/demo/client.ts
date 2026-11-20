/**
 * DEMO MODE ONLY. Implements the small part of the supabase-js API the billing
 * screens use (from/select/filters/order/limit/single/insert/update, rpc, auth),
 * backed by lib/demo/engine.ts.
 */
import { DEMO_OPERATOR, DemoError, OWNER_ONLY_SOURCES, callFunction, demoOperatorLogin, demoRole, loadDb, saveDb, setDemoRole, view } from "@/lib/demo/engine";

export const DEMO_EMAIL = "owner@shreeram.test";
export const DEMO_PASSWORD = "Shreeram@123";
export { DEMO_OPERATOR };
const SESSION_COOKIE = "srm-demo-session";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code: string } | null; count?: number | null };

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const asError = (e: unknown) => ({ message: e instanceof Error ? e.message : "Demo error", code: e instanceof DemoError ? e.code : "XX000" });

// Relations used by embedded selects such as "sales(fy, bill_no)" or "suppliers(name)".
const relations: Record<string, { table: string; key: string }> = {
  sales: { table: "sales", key: "sale_id" },
  suppliers: { table: "suppliers", key: "supplier_id" },
  customers: { table: "customers", key: "customer_id" },
};

function compare(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

function ilike(value: unknown, pattern: string) {
  const re = new RegExp("^" + pattern.split("%").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
  return re.test(String(value ?? ""));
}

class Query implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max?: number;
  private mode: "many" | "single" | "maybe" = "many";
  private action: "select" | "insert" | "update" = "select";
  private payload?: Row;
  private embeds: string[] = [];
  private countOnly = false;
  private returning = false;

  constructor(private table: string) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    if (this.action !== "select") this.returning = true;
    this.embeds = Object.keys(relations).filter((rel) => columns.includes(`${rel}(`));
    if (options?.head) this.countOnly = true;
    return this;
  }
  insert(row: Row) { this.action = "insert"; this.payload = row; return this; }
  update(row: Row) { this.action = "update"; this.payload = row; return this; }
  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this; }
  gt(col: string, v: unknown) { this.filters.push((r) => compare(r[col], v) > 0); return this; }
  gte(col: string, v: unknown) { this.filters.push((r) => compare(r[col], v) >= 0); return this; }
  lte(col: string, v: unknown) { this.filters.push((r) => compare(r[col], v) <= 0); return this; }
  in(col: string, values: unknown[]) { this.filters.push((r) => values.includes(r[col])); return this; }
  or(expr: string) {
    // Supports "col.ilike.pattern" and "col.eq.value" terms joined by commas.
    const terms = expr.split(",").map((term) => { const [col, op, ...rest] = term.split("."); return { col, op, value: rest.join(".") }; });
    this.filters.push((r) => terms.some(({ col, op, value }) => (op === "eq" ? String(r[col] ?? "") === value : ilike(r[col], value))));
    return this;
  }
  order(col: string, options?: { ascending?: boolean }) { this.orders.push({ col, asc: options?.ascending ?? true }); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  private rows(): Row[] {
    syncRole();
    if (demoRole() === "operator" && OWNER_ONLY_SOURCES.has(this.table)) return [];
    return view(this.table) ?? (loadDb().tables[this.table] as Row[] | undefined) ?? [];
  }

  private run(): Result {
    try {
      if (this.action === "insert") return this.finish(this.doInsert());
      if (this.action === "update") return this.finish(this.doUpdate());
      let rows = this.rows().filter((r) => this.filters.every((f) => f(r)));
      if (this.countOnly) return { data: null, error: null, count: rows.length };
      for (const { col, asc } of [...this.orders].reverse()) rows = [...rows].sort((a, b) => (asc ? 1 : -1) * compare(a[col], b[col]));
      if (this.max !== undefined) rows = rows.slice(0, this.max);
      rows = rows.map((r) => this.embed(r));
      return this.finish(rows);
    } catch (e) {
      return { data: null, error: asError(e) };
    }
  }

  private embed(row: Row): Row {
    if (!this.embeds.length) return row;
    const out = { ...row };
    for (const rel of this.embeds) {
      const { table, key } = relations[rel];
      out[rel] = (loadDb().tables[table] as Row[]).find((x) => x.id === row[key]) ?? null;
    }
    return out;
  }

  private finish(rows: Row[]): Result {
    if (this.action !== "select" && !this.returning) return { data: null, error: null };
    if (this.mode === "many") return { data: clone(rows), error: null };
    if (rows.length === 1) return { data: clone(rows[0]), error: null };
    if (rows.length === 0 && this.mode === "maybe") return { data: null, error: null };
    return { data: null, error: { message: rows.length ? "More than one row" : "Row not found", code: "PGRST116" } };
  }

  private checkUnique(row: Row, ignoreId?: unknown) {
    const others = (loadDb().tables[this.table] as Row[]).filter((r) => r.id !== ignoreId);
    const same = (a: unknown, b: unknown) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
    const clash = this.table === "products"
      ? others.some((r) => (same(r.name, row.name) && same(r.packing, row.packing)) || (row.barcode && r.barcode === row.barcode))
      : this.table === "suppliers" ? others.some((r) => same(r.name, row.name))
        : this.table === "customers" ? Boolean(row.phone) && others.some((r) => r.phone === row.phone) : false;
    if (clash) throw new DemoError("duplicate key value", "23505");
  }

  private guardWrite(row: Row, before?: Row) {
    syncRole();
    if (demoRole() === "owner") return;
    if (this.table !== "customers") throw new DemoError("new row violates row-level security policy", "42501");
    if (!before && Number(row.opening_balance ?? 0) !== 0) throw new DemoError("Only the owner can enter old udhaar");
    if (before && Number(row.opening_balance) !== Number(before.opening_balance)) throw new DemoError("Only the owner can change old udhaar");
  }

  private doInsert(): Row[] {
    const table = loadDb().tables[this.table] as Row[];
    const defaults: Row = this.table === "products"
      ? { company: "", packing: "", pack_size: 1, hsn: "", gst_rate: 12, barcode: null, reorder_level: 0, composition: "", active: true }
      : this.table === "suppliers" ? { phone: "", gstin: "", address: "", opening_balance: 0, active: true }
        : this.table === "customers" ? { phone: "", address: "", opening_balance: 0 } : {};
    const row: Row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults, ...this.payload };
    this.guardWrite(row);
    this.checkUnique(row);
    table.push(row);
    saveDb();
    return [row];
  }

  private doUpdate(): Row[] {
    const table = loadDb().tables[this.table] as Row[];
    const targets = table.filter((r) => this.filters.every((f) => f(r)));
    for (const r of targets) {
      const next = { ...r, ...this.payload, id: r.id };
      this.guardWrite(next, r);
      this.checkUnique(next, r.id);
      Object.assign(r, next);
    }
    saveDb();
    return targets;
  }

  then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

/** Demo session cookie holds "owner" or "operator:<email>". */
function session(): { role: "owner" | "operator"; email: string } | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!raw) return null;
  const value = decodeURIComponent(raw);
  if (value === "owner") return { role: "owner", email: DEMO_EMAIL };
  if (value.startsWith("operator:")) return { role: "operator", email: value.slice(9) };
  return null;
}
function syncRole() { setDemoRole(session()?.role ?? "owner"); }
function setSession(value: string | null) {
  document.cookie = value ? `${SESSION_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax` : `${SESSION_COOKIE}=; path=/; max-age=0`;
}
const demoUser = () => { const s = session(); return s ? { id: s.role === "owner" ? "00000000-0000-0000-0000-00000000demo" : `operator-${s.email}`, email: s.email } : null; };

export function createDemoClient() {
  return {
    isDemo: true,
    from: (table: string) => new Query(table),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      try {
        syncRole();
        const data = callFunction(name, args);
        saveDb();
        return { data: clone(data), error: null };
      } catch (e) {
        // Engine functions validate everything before changing data, so a failure changes nothing.
        return { data: null, error: asError(e) };
      }
    },
    auth: {
      getUser: async () => ({ data: { user: demoUser() }, error: null }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const address = email.trim().toLowerCase();
        if (address === DEMO_EMAIL && password === DEMO_PASSWORD) {
          setSession("owner");
          return { data: { user: demoUser() }, error: null };
        }
        if (demoOperatorLogin(address, password)) {
          setSession(`operator:${address}`);
          return { data: { user: demoUser() }, error: null };
        }
        return { data: { user: null }, error: { message: "Invalid login credentials", code: "invalid_credentials" } };
      },
      signOut: async () => { setSession(null); return { error: null }; },
      resetPasswordForEmail: async () => ({ data: {}, error: { message: "Not available in demo mode", code: "demo" } }),
      updateUser: async () => ({ data: {}, error: { message: "Not available in demo mode", code: "demo" } }),
    },
  };
}
