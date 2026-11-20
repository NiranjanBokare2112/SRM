/**
 * Local PostgreSQL mode: create an owner login or change its password.
 *   npm run db:password -- owner@example.com NewPassword123
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
const env = existsSync(envFile)
  ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => /^\s*[A-Z_]+\s*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const [email, password] = process.argv.slice(2);
if (!env.DATABASE_URL) { console.error("DATABASE_URL is missing from .env.local. Run npm run db:setup first."); process.exit(1); }
if (!email || !password || password.length < 8) { console.error("Usage: npm run db:password -- owner@example.com NewPassword123  (password at least 8 characters)"); process.exit(1); }

const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  const { rows } = await db.query(
    `insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
     values (gen_random_uuid(), lower($1), extensions.crypt($2, extensions.gen_salt('bf')), now(), 'authenticated', 'authenticated')
     on conflict (email) do update set encrypted_password = excluded.encrypted_password, updated_at = now()
     returning id, (xmax = 0) as created`,
    [email.trim(), password],
  );
  await db.query("insert into public.owners (user_id) values ($1) on conflict do nothing", [rows[0].id]);
  await db.query("commit");
  console.log(`${rows[0].created ? "Created" : "Updated"} owner login ${email.trim().toLowerCase()}.`);
} catch (error) {
  await db.query("rollback");
  console.error("Failed:", error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
