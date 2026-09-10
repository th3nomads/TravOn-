import { createSession, hashPassword, isValidEmail, json, normalizeEmail, readJson } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);

  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");

  if (!isValidEmail(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
  if (password.length > 128) return json({ error: "Password is too long." }, 400);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "An account with this email already exists." }, 409);

  const userId = crypto.randomUUID();
  const { hash, salt } = await hashPassword(password);

  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt) VALUES (?, ?, ?, ?)"
  ).bind(userId, email, hash, salt).run();

  const session = await createSession(env.DB, userId);
  return json({ user: { id: userId, name, email } }, 201, { "Set-Cookie": session.cookie });
}
