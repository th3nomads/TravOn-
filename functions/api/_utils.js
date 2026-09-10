const SESSION_COOKIE = "travon_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toBase64(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function hashPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );

  return {
    hash: toBase64(new Uint8Array(bits)),
    salt: toBase64(saltBytes)
  };
}

export async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, fromBase64(storedSalt));
  const a = new TextEncoder().encode(hash);
  const b = new TextEncoder().encode(storedHash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function createSession(DB, userId) {
  const sessionId = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(sessionId, userId, expires.toISOString()).run();

  return {
    id: sessionId,
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`
  };
}

export async function getCurrentUser(request, DB) {
  const sessionId = getCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;

  const row = await DB.prepare(
    `SELECT users.id, users.name, users.email
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ?`
  ).bind(sessionId, new Date().toISOString()).first();

  return row || null;
}

export async function requireUser(request, DB) {
  const user = await getCurrentUser(request, DB);
  if (!user) return { user: null, response: json({ error: "Not authenticated" }, 401) };
  return { user, response: null };
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}
