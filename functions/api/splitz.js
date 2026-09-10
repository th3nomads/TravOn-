import { json, readJson, requireUser } from "./_utils.js";

async function getTripAccess(DB, tripId, userId) {
  return await DB.prepare(
    `SELECT t.id, t.user_id AS ownerId, t.title,
            CASE WHEN t.user_id = ? THEN 'owner' WHEN EXISTS (SELECT 1 FROM trip_shares e WHERE e.trip_id=t.id AND e.recipient_id=? AND e.can_edit=1) THEN 'editor' ELSE 'shared' END AS access,
            COALESCE(t.splitz_json, '{"people":[],"expenses":[]}') AS splitzJson
       FROM trips t
      WHERE t.id = ?
        AND (
          t.user_id = ?
          OR EXISTS (
            SELECT 1 FROM trip_shares ts
             WHERE ts.trip_id = t.id AND ts.recipient_id = ?
          )
        )`
  ).bind(userId, userId, tripId, userId, userId).first();
}

async function getTripMembers(DB, tripId) {
  const result = await DB.prepare(
    `SELECT u.id, u.name, u.email, 'owner' AS role
       FROM trips t JOIN users u ON u.id = t.user_id
      WHERE t.id = ?
      UNION ALL
     SELECT u.id, u.name, u.email, CASE WHEN ts.can_edit=1 THEN 'editor' ELSE 'shared' END AS role
       FROM trip_shares ts JOIN users u ON u.id = ts.recipient_id
      WHERE ts.trip_id = ?`
  ).bind(tripId, tripId).all();
  return result.results || [];
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const tripId = String(url.searchParams.get("tripId") || "").trim();
  if (!tripId) return json({ error: "Trip is required." }, 400);

  const trip = await getTripAccess(env.DB, tripId, auth.user.id);
  if (!trip) return json({ error: "Trip not found or not shared with you." }, 404);

  let finances = { people: [], expenses: [] };
  try { finances = JSON.parse(trip.splitzJson || "{}"); } catch {}
  finances.people = Array.isArray(finances.people) ? finances.people : [];
  finances.expenses = Array.isArray(finances.expenses) ? finances.expenses : [];

  const members = await getTripMembers(env.DB, tripId);
  return json({
    trip: { id: trip.id, title: trip.title, access: trip.access, ownerId: trip.ownerId },
    members,
    finances
  });
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const tripId = String(body?.tripId || "").trim();
  if (!tripId) return json({ error: "Trip is required." }, 400);

  const trip = await getTripAccess(env.DB, tripId, auth.user.id);
  if (!trip) return json({ error: "Trip not found or not shared with you." }, 404);
  if (trip.access === "shared") return json({ error: "You have view-only access to these Splitz finances." }, 403);

  const finances = body?.finances || {};
  const people = Array.isArray(finances.people) ? finances.people.slice(0, 100) : [];
  const expenses = Array.isArray(finances.expenses) ? finances.expenses.slice(0, 1000) : [];

  await env.DB.prepare(
    "UPDATE trips SET splitz_json = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(JSON.stringify({ people, expenses }), tripId).run();

  return json({ ok: true });
}
