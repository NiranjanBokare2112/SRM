/**
 * Signed session cookie for local-PostgreSQL mode: "<userId>.<expiresAtMs>.<hmac>".
 * Uses Web Crypto so it works in both the proxy and route handlers.
 */
export const SESSION_COOKIE = "srm-session";
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

async function hmac(data: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is missing. Run npm run db:setup.");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Buffer.from(sig).toString("base64url");
}

export async function signSession(userId: string) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the user id for a valid, unexpired cookie, otherwise null. */
export async function verifySession(cookie: string | undefined | null): Promise<string | null> {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, sig] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !(Number(expires) > Date.now())) return null;
  try {
    const expected = await hmac(`${userId}.${expires}`);
    if (expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0 ? userId : null;
  } catch {
    return null;
  }
}
