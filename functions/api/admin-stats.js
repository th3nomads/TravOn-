import { json, requireUser } from "./_utils.js";

const ADMIN_EMAIL = "shariatsu@gmail.com";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);

  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const email = String(auth.user?.email || "").trim().toLowerCase();
  if (email !== ADMIN_EMAIL) return json({ error: "Not authorized." }, 403);

  const row = await env.DB.prepare("SELECT COUNT(*) AS totalUsers FROM users").first();
  return json({ totalUsers: Number(row?.totalUsers || 0) });
}
