import { createSession, json, normalizeEmail, readJson, verifyPassword } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);

  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");

  const user = await env.DB.prepare(
    "SELECT id, name, email, password_hash, password_salt FROM users WHERE email = ?"
  ).bind(email).first();

  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return json({ error: "Incorrect email or password." }, 401);
  }

  const session = await createSession(env.DB, user.id);
  return json({ user: { id: user.id, name: user.name || "", email: user.email } }, 200, { "Set-Cookie": session.cookie });
}
