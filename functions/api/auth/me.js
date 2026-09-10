import { getCurrentUser, json } from "../_utils.js";

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB) return json({ user: null, configured: false }, 200);
    const user = await getCurrentUser(request, env.DB);
    return json({ user, configured: true });
  } catch (error) {
    return json({ user: null, configured: true, error: error?.message || "Session check failed." }, 500);
  }
}
