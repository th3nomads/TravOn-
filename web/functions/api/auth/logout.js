import { clearSessionCookie, getCookie, json, sessionCookieName } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  if (env.DB) {
    const sessionId = getCookie(request, sessionCookieName());
    if (sessionId) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    }
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
