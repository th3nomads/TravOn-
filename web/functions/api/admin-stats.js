import { json, requireUser } from "./_utils.js";

const ADMIN_EMAIL = "shariatsu@gmail.com";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);

  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const email = String(auth.user?.email || "").trim().toLowerCase();
  if (email !== ADMIN_EMAIL) return json({ error: "Not authorized." }, 403);

  const usersResult = await env.DB.prepare(
    "SELECT name, email, created_at FROM users ORDER BY datetime(created_at) DESC"
  ).all();

  const users = (usersResult?.results || []).map((user) => ({
    name: String(user?.name || "").trim(),
    email: String(user?.email || "").trim(),
    createdAt: user?.created_at || null
  }));

  return json({ totalUsers: users.length, users });
}
