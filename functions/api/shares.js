import { json, readJson, requireUser, normalizeEmail, isValidEmail } from "./_utils.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const { results: outgoing = [] } = await env.DB.prepare(
    `SELECT ts.id, ts.trip_id AS tripId, ts.recipient_id AS personId,
            COALESCE(u.name, '') AS name, u.email,
            t.title AS tripTitle, t.start_date AS startDate, t.end_date AS endDate,
            ts.can_edit AS canEdit, ts.created_at AS sharedAt, 'outgoing' AS direction
       FROM trip_shares ts
       JOIN trips t ON t.id = ts.trip_id
       JOIN users u ON u.id = ts.recipient_id
      WHERE ts.owner_id = ?`
  ).bind(auth.user.id).all();

  const { results: incoming = [] } = await env.DB.prepare(
    `SELECT ts.id, ts.trip_id AS tripId, ts.owner_id AS personId,
            COALESCE(u.name, '') AS name, u.email,
            t.title AS tripTitle, t.start_date AS startDate, t.end_date AS endDate,
            ts.can_edit AS canEdit, ts.created_at AS sharedAt, 'incoming' AS direction
       FROM trip_shares ts
       JOIN trips t ON t.id = ts.trip_id
       JOIN users u ON u.id = ts.owner_id
      WHERE ts.recipient_id = ?`
  ).bind(auth.user.id).all();

  return json({ shares: [...outgoing, ...incoming] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  const tripId = String(body?.tripId || "").trim();
  const email = normalizeEmail(body?.email);
  const canEdit = body?.canEdit === true ? 1 : 0;
  if (!tripId) return json({ error: "Trip is required." }, 400);
  if (!isValidEmail(email)) return json({ error: "Enter a valid TravOn account email." }, 400);

  const trip = await env.DB.prepare("SELECT id, title FROM trips WHERE id = ? AND user_id = ?").bind(tripId, auth.user.id).first();
  if (!trip) return json({ error: "Trip not found." }, 404);

  const recipient = await env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(email).first();
  if (!recipient) return json({ error: "No TravOn account was found with that email. Ask them to create an account first." }, 404);
  if (recipient.id === auth.user.id) return json({ error: "You already own this itinerary." }, 400);

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO trip_shares (id, trip_id, owner_id, recipient_id, can_edit) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, tripId, auth.user.id, recipient.id, canEdit).run();
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return json({ error: "This trip is already shared with " + (recipient.name || recipient.email) + "." }, 409);
    }
    throw error;
  }

  return json({ share: { id, tripId, recipientId: recipient.id, name: recipient.name || "", email: recipient.email, tripTitle: trip.title, canEdit: !!canEdit } }, 201);
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  const shareId = String(body?.shareId || "").trim();
  const canEdit = body?.canEdit === true ? 1 : 0;
  if (!shareId) return json({ error: "Share is required." }, 400);

  const share = await env.DB.prepare(
    "SELECT id FROM trip_shares WHERE id = ? AND owner_id = ?"
  ).bind(shareId, auth.user.id).first();
  if (!share) return json({ error: "Only the itinerary owner can change access." }, 403);

  await env.DB.prepare("UPDATE trip_shares SET can_edit = ? WHERE id = ? AND owner_id = ?")
    .bind(canEdit, shareId, auth.user.id).run();
  return json({ ok: true, canEdit: !!canEdit });
}
