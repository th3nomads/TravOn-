import { json } from "./_utils.js";

export async function onRequestGet({ env }) {
  try {
    if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 503);

    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();

    return json({
      ok: true,
      binding: true,
      tables: (tables.results || []).map(row => row.name)
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || "Database health check failed." }, 500);
  }
}
