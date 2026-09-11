import { json, readJson, requireUser, normalizeEmail, isValidEmail } from "./_utils.js";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join(" ");
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const { results: outgoing = [] } = await env.DB.prepare(
    `SELECT ts.id, ts.trip_id AS tripId, ts.recipient_id AS personId,
            COALESCE(u.name, '') AS name, u.email,
            t.title AS tripTitle, t.start_date AS startDate, t.end_date AS endDate,
            ts.created_at AS sharedAt, 'outgoing' AS direction
       FROM trip_shares ts
       JOIN trips t ON t.id = ts.trip_id
       JOIN users u ON u.id = ts.recipient_id
      WHERE ts.owner_id = ?`
  ).bind(auth.user.id).all();

  const { results: incoming = [] } = await env.DB.prepare(
    `SELECT ts.id, ts.trip_id AS tripId, ts.owner_id AS personId,
            COALESCE(u.name, '') AS name, u.email,
            t.title AS tripTitle, t.start_date AS startDate, t.end_date AS endDate,
            ts.created_at AS sharedAt, 'incoming' AS direction
       FROM trip_shares ts
       JOIN trips t ON t.id = ts.trip_id
       JOIN users u ON u.id = ts.owner_id
      WHERE ts.recipient_id = ?`
  ).bind(auth.user.id).all();

  const shares = [...outgoing, ...incoming].map(share => ({
    ...share,
    name: normalizeName(share.name)
  }));

  return json({ shares });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  const tripId = String(body?.tripId || "").trim();
  const email = normalizeEmail(body?.email);
  if (!tripId) return json({ error: "Trip is required." }, 400);
  if (!isValidEmail(email)) return json({ error: "Enter a valid TravOn account email." }, 400);

  const trip = await env.DB.prepare("SELECT id, title FROM trips WHERE id = ? AND user_id = ?").bind(tripId, auth.user.id).first();
  if (!trip) return json({ error: "Trip not found." }, 404);

  const recipient = await env.DB.prepare("SELECT id, name, email FROM users WHERE email = ?").bind(email).first();
  if (!recipient) return json({ error: "No TravOn account was found with that email. Ask them to create an account first." }, 404);
  if (recipient.id === auth.user.id) return json({ error: "You already own this Itinerary." }, 400);

  const recipientName = normalizeName(recipient.name);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO trip_shares (id, trip_id, owner_id, recipient_id) VALUES (?, ?, ?, ?)"
    ).bind(id, tripId, auth.user.id, recipient.id).run();
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) {
      return json({ error: "This trip is already shared with " + (recipientName || recipient.email) + "." }, 409);
    }
    throw error;
  }

  return json({ share: { id, tripId, recipientId: recipient.id, name: recipientName, email: recipient.email, tripTitle: trip.title } }, 201);
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: "Database is not configured yet." }, 503);
  const auth = await requireUser(request, env.DB);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const tripId = String(body?.tripId || "").trim();
  if (!tripId) return json({ error: "Trip is required." }, 400);

  const share = await env.DB.prepare(
    "SELECT id FROM trip_shares WHERE trip_id = ? AND recipient_id = ?"
  ).bind(tripId, auth.user.id).first();

  if (!share) return json({ error: "Shared Itinerary not found." }, 404);

  await env.DB.prepare(
    "DELETE FROM trip_shares WHERE trip_id = ? AND recipient_id = ?"
  ).bind(tripId, auth.user.id).run();

  return json({ ok: true });
}
