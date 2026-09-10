const tripSelect = document.querySelector("#mapTripSelect");
const mapStatus = document.querySelector("#mapStatus");
const mapEl = document.querySelector("#tripMap");

let trips = [];
let currentUser = null;
let markerLayer = null;

const map = L.map(mapEl, { zoomControl: true }).setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
}).addTo(map);
markerLayer = L.layerGroup().addTo(map);

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value + "T12:00:00"));
}

function formatTime(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hours, minutes));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function readGeoCache() {
  try { return JSON.parse(localStorage.getItem("travon.mapGeoCache.v1") || "{}"); }
  catch { return {}; }
}

function writeGeoCache(cache) {
  try { localStorage.setItem("travon.mapGeoCache.v1", JSON.stringify(cache)); } catch {}
}

function normalizedKey(query) {
  return String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function geocode(query, type = "activity") {
  const cleaned = String(query || "").trim();
  if (cleaned.length < 2) return null;
  const cache = readGeoCache();
  const key = normalizedKey(type + "|" + cleaned);
  const cached = cache[key];
  if (cached && Number.isFinite(Number(cached.lat)) && Number.isFinite(Number(cached.lon))) return cached;

  try {
    const data = await api("/api/activity-search?q=" + encodeURIComponent(cleaned) + "&type=" + encodeURIComponent(type), { method: "GET", headers: {} });
    const result = (data.results || []).find(item => item.lat != null && item.lon != null);
    if (!result) return null;
    const point = {
      lat: Number(result.lat),
      lon: Number(result.lon),
      address: result.address || result.description || cleaned,
      title: result.title || cleaned
    };
    cache[key] = point;
    writeGeoCache(cache);
    return point;
  } catch {
    return null;
  }
}

function queryForActivity(activity) {
  const d = activity.details || {};
  if (activity.type === "hotel") return d.address || d.name || activity.title;
  if (activity.type === "restaurant") return d.address || d.name || activity.title;
  if (activity.type === "airport") return [d.name || activity.title, d.code].filter(Boolean).join(" ");
  if (activity.type === "car_rental") return d.pickup || d.company || activity.title;
  return d.address || activity.title;
}

function activityPoints(activity) {
  const d = activity.details || {};
  const base = {
    activity,
    date: activity.date,
    time: activity.time,
    type: activity.type || "activity"
  };

  if (activity.type === "flight") {
    return [
      d.from ? { ...base, label: activity.title + " · Departure", query: d.from, type: "airport" } : null,
      d.to ? { ...base, label: activity.title + " · Arrival", query: d.to, type: "airport" } : null
    ].filter(Boolean);
  }

  if (activity.type === "car_rental") {
    const points = [];
    if (d.pickup) points.push({ ...base, label: activity.title + " · Pickup", query: d.pickup, type: "car_rental" });
    if (d.dropoff && normalizedKey(d.dropoff) !== normalizedKey(d.pickup)) points.push({ ...base, label: activity.title + " · Drop-off", query: d.dropoff, type: "car_rental" });
    if (points.length) return points;
  }

  return [{ ...base, label: activity.title || "Itinerary place", query: queryForActivity(activity) }];
}

function popupHtml(point, geo) {
  const meta = [formatDate(point.date), formatTime(point.time)].filter(Boolean).join(" · ");
  const destination = encodeURIComponent(geo.lat + "," + geo.lon);
  return `
    <strong>${escapeHtml(point.label)}</strong>
    ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
    ${geo.address ? `<small>${escapeHtml(geo.address)}</small>` : ""}
    <a class="map-popup-link" href="https://www.google.com/maps/dir/?api=1&destination=${destination}" target="_blank" rel="noopener">Directions ↗</a>
  `;
}

async function renderTripMap(tripId) {
  markerLayer.clearLayers();
  const trip = trips.find(item => String(item.id) === String(tripId));
  if (!trip) {
    mapStatus.textContent = "Choose a trip to display its places.";
    map.setView([20, 0], 2);
    return;
  }

  const activities = Array.isArray(trip.activities) ? trip.activities : [];
  const candidates = activities.flatMap(activityPoints).filter(point => String(point.query || "").trim().length > 1);
  if (!candidates.length) {
    mapStatus.textContent = "This itinerary does not have any mappable places yet. Add hotels, restaurants, airports, car rentals, or activities in the trip planner.";
    map.setView([20, 0], 2);
    return;
  }

  mapStatus.textContent = `Finding ${candidates.length} ${candidates.length === 1 ? "place" : "places"} for ${trip.title}…`;
  const resolved = [];

  for (const point of candidates) {
    const geo = await geocode(point.query, point.type);
    if (!geo) continue;
    resolved.push({ point, geo });
    L.circleMarker([geo.lat, geo.lon], {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#18b5bd",
      fillOpacity: 1
    }).bindPopup(popupHtml(point, geo)).addTo(markerLayer);
  }

  if (!resolved.length) {
    mapStatus.textContent = "We could not locate the places in this itinerary yet. Try selecting places from the planner search so their addresses are more specific.";
    map.setView([20, 0], 2);
    return;
  }

  const bounds = L.latLngBounds(resolved.map(item => [item.geo.lat, item.geo.lon]));
  map.fitBounds(bounds.pad(0.18), { maxZoom: 14 });
  const skipped = candidates.length - resolved.length;
  mapStatus.textContent = `${resolved.length} ${resolved.length === 1 ? "place" : "places"} shown${skipped ? ` · ${skipped} could not be located` : ""}. Tap a dot for details and directions.`;
}

function populateTrips() {
  if (!trips.length) {
    tripSelect.innerHTML = '<option value="">No itineraries yet</option>';
    tripSelect.disabled = true;
    mapStatus.textContent = "Create an itinerary and add places to see them here.";
    return;
  }

  tripSelect.disabled = false;
  tripSelect.innerHTML = trips
    .slice()
    .sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")))
    .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}${item.access === "shared" || item.access === "editor" ? " · Shared" : ""}</option>`)
    .join("");

  const requestedTrip = new URLSearchParams(location.search).get("id");
  if (requestedTrip && trips.some(item => String(item.id) === String(requestedTrip))) tripSelect.value = requestedTrip;
  renderTripMap(tripSelect.value);
}

async function loadTrips() {
  try {
    const me = await api("/api/auth/me");
    currentUser = me.user || null;
  } catch {
    currentUser = null;
  }

  if (currentUser) {
    try {
      const data = await api("/api/trips");
      trips = Array.isArray(data.trips) ? data.trips : [];
    } catch {
      trips = [];
    }
  } else {
    try { trips = JSON.parse(localStorage.getItem("travon.trips.v2") || "[]"); }
    catch { trips = []; }
  }
  populateTrips();
}

tripSelect.addEventListener("change", () => {
  const url = new URL(location.href);
  if (tripSelect.value) url.searchParams.set("id", tripSelect.value);
  else url.searchParams.delete("id");
  history.replaceState({}, "", url);
  renderTripMap(tripSelect.value);
});

loadTrips();