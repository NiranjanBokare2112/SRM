import "server-only";
import pg from "pg";

/**
 * Local-PostgreSQL mode: runs the browser's query specs as parameterised SQL.
 * Every request runs in its own transaction as the "authenticated" role with
 * request.jwt.claim.sub = the signed-in user, so the migration's row level
 * security and owner checks apply exactly as they do on Supabase.
 */

// Return numbers for numeric/bigint, plain strings for dates, ISO strings for timestamps.
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());

const globalForPool = globalThis as unknown as { srmPool?: pg.Pool };
export const pool = globalForPool.srmPool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
globalForPool.srmPool = pool;

export class DbError extends Error {
  constructor(message: string, public code = "XX000", public status = 400) { super(message); }
}

const TABLES = new Set([
  "shop_settings", "staff", "suppliers", "products", "batches", "sales", "sale_items", "sales_returns", "sales_return_items",
  "purchases", "purchase_items", "supplier_payments", "stock_adjustments", "product_stock", "supplier_balances",
  "customers", "customer_payments", "customer_balances",
  "batches_public", "sales_public", "sale_items_public", "sales_returns_public", "operator_list",
]);
const RELATIONS: Record<string, { table: string; key: string }> = {
  sales: { table: "sales", key: "sale_id" },
  suppliers: { table: "suppliers", key: "supplier_id" },
  customers: { table: "customers", key: "customer_id" },
};
const FUNCTIONS: Record<string, { args: string[]; set?: boolean }> = {
  is_owner: { args: [] },
  create_sale: { args: ["p"] },
  create_sales_return: { args: ["p"] },
  create_purchase: { args: ["p"] },
  add_opening_stock: { args: ["p_product_id", "p_batch_no", "p_expiry_month", "p_expiry_year", "p_mrp", "p_purchase_rate", "p_packs", "p_loose"] },
  adjust_stock: { args: ["p_batch_id", "p_units", "p_reason", "p_note"] },
  save_staff: { args: ["p_id", "p_name", "p_pin", "p_active"] },
  record_supplier_payment: { args: ["p_supplier_id", "p_amount", "p_mode", "p_note", "p_date"] },
  sales_summary: { args: ["p_from", "p_to"] },
  gst_summary: { args: ["p_from", "p_to"], set: true },
  dashboard_stats: { args: ["p_from", "p_to"] },
  record_customer_payment: { args: ["p_customer_id", "p_amount", "p_mode", "p_note", "p_date"] },
  my_role: { args: [] },
  create_operator: { args: ["p_email", "p_password", "p_name"] },
  set_operator_password: { args: ["p_user_id", "p_password"] },
  remove_operator: { args: ["p_user_id"] },
};
const JSON_ARGS = new Set(["p"]);

const ident = (name: unknown) => {
  if (typeof name !== "string" || !/^[a-z_][a-z0-9_]*$/.test(name)) throw new DbError("Invalid column name");
  return `"${name}"`;
};

export type Filter = { op: "eq" | "gt" | "gte" | "lte" | "in" | "or"; col?: string; value: unknown };
export type QuerySpec = {
  action: "select" | "insert" | "update";
  table: string;
  columns?: string;
  head?: boolean;
  returning?: boolean;
  filters?: Filter[];
  orders?: { col: string; asc: boolean }[];
  limit?: number;
  mode?: "many" | "single" | "maybe";
  payload?: Record<string, unknown>;
};

/** Splits "a, b, sales(x, y)" at top-level commas. */
function splitColumns(columns: string) {
  const out: string[] = [];
  let depth = 0, current = "";
  for (const ch of columns) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(current.trim()); current = ""; } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function selectList(columns: string | undefined) {
  const parts = splitColumns(columns?.trim() || "*");
  return parts.map((part) => {
    if (part === "*") return "t.*";
    const embed = part.match(/^([a-z_]+)\(([\s\S]*)\)$/);
    if (embed) {
      const rel = RELATIONS[embed[1]];
      if (!rel) throw new DbError(`Unknown relation ${embed[1]}`);
      const cols = splitColumns(embed[2]).map((c) => (c === "*" ? "r.*" : `r.${ident(c)}`)).join(", ");
      return `(select to_jsonb(x) from (select ${cols} from public.${ident(rel.table)} r where r.id = t.${ident(rel.key)}) x) as ${ident(embed[1])}`;
    }
    return `t.${ident(part)}`;
  }).join(", ");
}

function whereClause(filters: Filter[] = [], params: unknown[]) {
  const add = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const parts = filters.map((f) => {
    switch (f.op) {
      case "eq": return `t.${ident(f.col)} = ${add(f.value)}`;
      case "gt": return `t.${ident(f.col)} > ${add(f.value)}`;
      case "gte": return `t.${ident(f.col)} >= ${add(f.value)}`;
      case "lte": return `t.${ident(f.col)} <= ${add(f.value)}`;
      case "in": {
        if (!Array.isArray(f.value) || f.value.length === 0) return "false";
        return `t.${ident(f.col)}::text = any(${add(f.value.map(String))}::text[])`;
      }
      case "or": {
        // "col.ilike.pattern,col.eq.value" (the subset supabase-js callers use here)
        const terms = String(f.value).split(",").map((term) => {
          const [col, op, ...rest] = term.split(".");
          const value = rest.join(".");
          if (op === "ilike") return `t.${ident(col)}::text ilike ${add(value)}`;
          if (op === "eq") return `t.${ident(col)}::text = ${add(value)}`;
          throw new DbError("Unsupported filter");
        });
        return `(${terms.join(" or ")})`;
      }
      default: throw new DbError("Unsupported filter");
    }
  });
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

function orderClause(orders: QuerySpec["orders"] = []) {
  return orders.length ? ` order by ${orders.map((o) => `t.${ident(o.col)} ${o.asc ? "asc" : "desc"} nulls last`).join(", ")}` : "";
}

function build(spec: QuerySpec): { text: string; params: unknown[] } {
  if (!TABLES.has(spec.table)) throw new DbError("Unknown table");
  const table = `public.${ident(spec.table)}`;
  const params: unknown[] = [];

  if (spec.action === "select") {
    if (spec.head) return { text: `select count(*)::int as count from ${table} t${whereClause(spec.filters, params)}`, params };
    const limit = spec.limit ? ` limit ${Math.min(Math.max(1, Math.floor(spec.limit)), 10000)}` : "";
    return { text: `select ${selectList(spec.columns)} from ${table} t${whereClause(spec.filters, params)}${orderClause(spec.orders)}${limit}`, params };
  }

  const payload = spec.payload ?? {};
  const keys = Object.keys(payload);
  if (keys.length === 0) throw new DbError("Nothing to save");
  const value = (k: string) => { const v = payload[k]; return v !== null && typeof v === "object" ? JSON.stringify(v) : v; };
  const returning = spec.returning ? ` returning ${selectList(spec.columns)}` : "";

  if (spec.action === "insert") {
    const cols = keys.map(ident).join(", ");
    const vals = keys.map((k) => { params.push(value(k)); return `$${params.length}`; }).join(", ");
    return { text: `insert into ${table} as t (${cols}) values (${vals})${returning}`, params };
  }
  if (spec.action === "update") {
    if (!spec.filters?.length) throw new DbError("Update needs a filter");
    const sets = keys.map((k) => { params.push(value(k)); return `${ident(k)} = $${params.length}`; }).join(", ");
    return { text: `update ${table} as t set ${sets}${whereClause(spec.filters, params)}${returning}`, params };
  }
  throw new DbError("Unknown action");
}

async function asUser<T>(userId: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("set local role authenticated");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function runQuery(userId: string, spec: QuerySpec) {
  const { text, params } = build(spec);
  const result = await asUser(userId, (c) => c.query(text, params));
  if (spec.head) return { data: null, count: result.rows[0]?.count ?? 0 };
  const rows = result.rows;
  if (spec.action !== "select" && !spec.returning) return { data: null };
  if (!spec.mode || spec.mode === "many") return { data: rows };
  if (rows.length === 1) return { data: rows[0] };
  if (rows.length === 0 && spec.mode === "maybe") return { data: null };
  throw new DbError(rows.length ? "More than one row returned" : "Row not found", "PGRST116", 406);
}

export async function runFunction(userId: string, name: string, args: Record<string, unknown> = {}) {
  const fn = FUNCTIONS[name];
  if (!fn) throw new DbError("Unknown function", "42883", 404);
  const params: unknown[] = [];
  const named = fn.args.filter((a) => a in args).map((a) => {
    const v = args[a];
    params.push(JSON_ARGS.has(a) ? JSON.stringify(v ?? null) : v);
    return `${a} => $${params.length}${JSON_ARGS.has(a) ? "::jsonb" : ""}`;
  });
  const call = `public.${ident(name)}(${named.join(", ")})`;
  const text = fn.set ? `select * from ${call}` : `select ${call} as result`;
  const result = await asUser(userId, (c) => c.query(text, params));
  return { data: fn.set ? result.rows : result.rows[0]?.result ?? null };
}

export async function verifyPassword(email: string, password: string) {
  const { rows } = await pool.query<{ id: string; email: string }>(
    "select id, email from auth.users where lower(email) = lower($1) and encrypted_password = extensions.crypt($2, encrypted_password)",
    [email.trim(), password],
  );
  return rows[0] ?? null;
}

export async function getUserById(id: string) {
  const { rows } = await pool.query<{ id: string; email: string }>("select id, email from auth.users where id = $1", [id]);
  return rows[0] ?? null;
}

/** Converts a pg error into the {message, code} shape the screens expect. Never leaks SQL text. */
export function toClientError(error: unknown) {
  if (error instanceof DbError) return { status: error.status, body: { message: error.message, code: error.code } };
  const e = error as { code?: string; message?: string };
  if (e?.code === "P0001" || e?.code === "42501" || e?.code === "23505" || e?.code === "PGRST116") {
    return { status: 400, body: { message: e.message ?? "Request failed", code: e.code } };
  }
  console.error("[localdb]", error);
  return { status: 500, body: { message: "Database error", code: "XX000" } };
}
