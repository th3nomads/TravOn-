import { json, readJson, requireUser } from "../_utils.js";

function mapTrip(row) {
  let activities = [];
  try { activities = JSON.parse(row.activities_json || "[]"); } catch {}
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    activities,
    access: row.access || "owner",
    ownerId: row.owner_id || row.user_id || null,
    ownerName: row.owner_name || "",
    ownerEmail: row.owner_email || ""
  };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const result = await env.DB.prepare(
    `SELECT t.*, 'owner' AS access,
            t.user_id AS owner_id,
            COALESCE(u.name, '') AS owner_name,
            u.email AS owner_email
       FROM trips t
       JOIN users u ON u.id = t.user_id
      WHERE t.user_id = ?

      UNION ALL

     SELECT t.*, CASE WHEN ts.can_edit = 1 THEN 'editor' ELSE 'shared' END AS access,
            t.user_id AS owner_id,
            COALESCE(owner.name, '') AS owner_name,
            owner.email AS owner_email
       FROM trip_shares ts
       JOIN trips t ON t.id = ts.trip_id
       JOIN users owner ON owner.id = t.user_id
      WHERE ts.recipient_id = ?

      ORDER BY start_date ASC`
  ).bind(auth.user.id, auth.user.id).all();

  return json({ trips: (result.results || []).map(mapTrip) });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const title = String(body?.title || "").trim();
  const startDate = String(body?.startDate || "");
  const endDate = String(body?.endDate || "");

  if (!title || !startDate || !endDate || endDate < startDate) {
    return json({ error: "Enter a valid trip name and date range." }, 400);
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO trips (id, user_id, title, start_date, end_date, activities_json) VALUES (?, ?, ?, ?, ?, '[]')"
  ).bind(id, auth.user.id, title, startDate, endDate).run();

  return json({ trip: { id, title, startDate, endDate, activities: [] } }, 201);
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const id = String(body?.id || "");
  const activities = Array.isArray(body?.activities) ? body.activities : [];

  const existing = await env.DB.prepare(
    `SELECT t.id FROM trips t
      WHERE t.id = ? AND (
        t.user_id = ? OR EXISTS (
          SELECT 1 FROM trip_shares ts
           WHERE ts.trip_id = t.id AND ts.recipient_id = ? AND ts.can_edit = 1
        )
      )`
  ).bind(id, auth.user.id, auth.user.id).first();

  if (!existing) return json({ error: "You do not have edit access to this itinerary." }, 403);

  await env.DB.prepare(
    "UPDATE trips SET activities_json = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(JSON.stringify(activities), id).run();

  return json({ ok: true });
}


export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const id = String(body?.id || "").trim();
  if (!id) return json({ error: "Trip ID is required." }, 400);

  const existing = await env.DB.prepare(
    "SELECT id FROM trips WHERE id = ? AND user_id = ?"
  ).bind(id, auth.user.id).first();

  if (!existing) return json({ error: "Trip not found." }, 404);

  await env.DB.prepare(
    "DELETE FROM trips WHERE id = ? AND user_id = ?"
  ).bind(id, auth.user.id).run();

  return json({ ok: true });
}
