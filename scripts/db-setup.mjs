/**
 * Sets up the billing database on local PostgreSQL.
 *
 *   npm run db:setup            create database + tables (+ demo data if new); run again to apply new migrations
 *   npm run db:setup -- --reset drop and recreate the database (ERASES all billing data)
 *
 * Reads DATABASE_URL from .env.local, e.g.
 *   DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/srm_billing
 * Also adds NEXT_PUBLIC_DB_MODE=local and a random SESSION_SECRET to .env.local if missing.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const reset = process.argv.includes("--reset");

function readEnv() {
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, "utf8").split(/\r?\n/).filter((l) => /^\s*[A-Z_]+\s*=/.test(l))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
  );
}

let env = readEnv();
if (!env.DATABASE_URL) {
  console.error("\nAdd this line to .env.local first (use your PostgreSQL password):\n\n  DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/srm_billing\n");
  process.exit(1);
}
const additions = [];
if (env.NEXT_PUBLIC_DB_MODE !== "local") additions.push("NEXT_PUBLIC_DB_MODE=local");
if (!env.SESSION_SECRET) additions.push(`SESSION_SECRET=${randomBytes(32).toString("hex")}`);
if (additions.length) {
  appendFileSync(envPath, `\n# Added by npm run db:setup\n${additions.join("\n")}\n`);
  console.log(`Added to .env.local: ${additions.map((a) => a.split("=")[0]).join(", ")}`);
  env = readEnv();
}

const target = new URL(env.DATABASE_URL);
const dbName = decodeURIComponent(target.pathname.replace(/^\//, "")) || "srm_billing";
if (!/^[a-z0-9_]+$/i.test(dbName)) { console.error(`Unsafe database name "${dbName}".`); process.exit(1); }
const adminUrl = new URL(env.DATABASE_URL);
adminUrl.pathname = "/postgres";

const sql = (file) => readFileSync(path.join(root, file), "utf8");

try {
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  if (reset) {
    await admin.query(`drop database if exists "${dbName}" with (force)`);
    console.log(`Dropped database ${dbName}.`);
  }
  const exists = (await admin.query("select 1 from pg_database where datname = $1", [dbName])).rowCount > 0;
  if (!exists) {
    await admin.query(`create database "${dbName}"`);
    console.log(`Created database ${dbName}.`);
  }
  await admin.end();

  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  // Apply every migration in supabase/migrations once, in filename order, and remember which ran.
  const fresh = !(await db.query("select to_regclass('public.owners') is not null as ok")).rows[0].ok;
  if (fresh) await db.query(sql("supabase/local/00_local_shim.sql"));
  await db.query("create table if not exists public._local_migrations (name text primary key, applied_at timestamptz not null default now())");
  await db.query("revoke all on public._local_migrations from anon, authenticated");
  if (!fresh) {
    // Databases set up before migration tracking existed already have the first migration.
    await db.query("insert into public._local_migrations (name) values ('20261121000000_billing.sql') on conflict do nothing");
  }
  const done = new Set((await db.query("select name from public._local_migrations")).rows.map((r) => r.name));
  const files = readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    await db.query("begin");
    try {
      await db.query(sql(`supabase/migrations/${file}`));
      await db.query("insert into public._local_migrations (name) values ($1)", [file]);
      await db.query("commit");
      console.log(`Applied ${file}`);
    } catch (error) {
      await db.query("rollback");
      throw new Error(`${file}: ${error.message}`);
    }
  }
  if (fresh) {
    await db.query(sql("supabase/seed_demo.sql"));
    console.log("Loaded demo data.");
  } else if (files.every((f) => done.has(f))) {
    console.log("Database is up to date.");
  }
  const owners = (await db.query("select u.email from public.owners o join auth.users u on u.id = o.user_id")).rows;
  await db.end();
  console.log(`\nReady. Owner logins: ${owners.map((o) => o.email).join(", ") || "(none)"}`);
  if (owners.some((o) => o.email === "owner@shreeram.test")) console.log("Demo login: owner@shreeram.test / Shreeram@123   Staff PIN: 1234");
  console.log("Restart `npm run dev` so the app picks up .env.local.\n");
} catch (error) {
  console.error("\nDatabase setup failed:", error.message);
  if (/password authentication failed/i.test(error.message)) console.error("Check the password in DATABASE_URL in .env.local.");
  if (/ECONNREFUSED/i.test(error.message)) console.error("Is the PostgreSQL service running?");
  process.exit(1);
}
