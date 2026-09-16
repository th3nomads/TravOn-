function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" }
  });
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const HILTON_BRANDS = /\b(hilton|doubletree|hampton|embassy suites|homewood suites|home2 suites|conrad|waldorf astoria|canopy|curio collection|tapestry collection|tru by hilton|tempo by hilton|motto by hilton|signia by hilton|spark by hilton|livsmart studios)\b/i;

function distanceMiles(lat1, lon1, lat2, lon2) {
  const r = 3958.8;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.GEOAPIFY_API_KEY) return json({ error: "Geoapify is not configured yet.", results: [] }, 503);
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const radius = Math.min(Math.max(Number(url.searchParams.get("radius")) || 25000, 3000), 50000);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: "Valid latitude and longitude are required.", results: [] }, 400);

    const params = new URLSearchParams({
      categories: "accommodation.hotel",
      filter: `circle:${lon},${lat},${radius}`,
      bias: `proximity:${lon},${lat}`,
      limit: "100",
      apiKey: env.GEOAPIFY_API_KEY
    });
    const response = await fetch("https://api.geoapify.com/v2/places?" + params.toString());
    if (!response.ok) throw new Error("Nearby hotel lookup failed.");
    const data = await response.json();

    const results = (data.features || []).map(feature => {
      const p = feature.properties || {};
      const name = clean(p.name);
      const address = clean(p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(", "));
      const hotelLat = Number(p.lat ?? feature.geometry?.coordinates?.[1]);
      const hotelLon = Number(p.lon ?? feature.geometry?.coordinates?.[0]);
      return {
        id: p.place_id || `${hotelLat},${hotelLon}`,
        name,
        address,
        lat: hotelLat,
        lon: hotelLon,
        distanceMiles: distanceMiles(lat, lon, hotelLat, hotelLon)
      };
    }).filter(hotel => hotel.name && HILTON_BRANDS.test(hotel.name) && Number.isFinite(hotel.lat) && Number.isFinite(hotel.lon))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 30);

    return json({ results });
  } catch (error) {
    return json({ error: error?.message || "Nearby Hilton lookup failed.", results: [] }, 500);
  }
}
