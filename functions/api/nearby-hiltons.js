function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=1800" }
  });
}

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }

const HILTON_BRANDS = /\b(hilton|doubletree|hampton|embassy suites|homewood suites|home2 suites|conrad|waldorf astoria|canopy by hilton|curio collection|tapestry collection|signia by hilton|tru by hilton|motto by hilton|tempo by hilton|spark by hilton|graduate by hilton|livsmart studios)\b/i;

export async function onRequestGet({ request, env }) {
  try {
    if (!env.GEOAPIFY_API_KEY) return json({ error: "Geoapify is not configured.", hotels: [] }, 503);
    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q"));
    if (q.length < 2 || q.length > 180) return json({ hotels: [] });

    const geocodeParams = new URLSearchParams({ text: q, format: "json", lang: "en", limit: "1", apiKey: env.GEOAPIFY_API_KEY });
    const geoRes = await fetch("https://api.geoapify.com/v1/geocode/search?" + geocodeParams.toString());
    if (!geoRes.ok) throw new Error("Could not locate itinerary activity.");
    const geo = await geoRes.json();
    const center = geo.results?.[0];
    if (!center?.lat || !center?.lon) return json({ hotels: [] });

    const placesParams = new URLSearchParams({
      categories: "accommodation.hotel",
      filter: `circle:${center.lon},${center.lat},25000`,
      bias: `proximity:${center.lon},${center.lat}`,
      limit: "100",
      apiKey: env.GEOAPIFY_API_KEY
    });
    const placesRes = await fetch("https://api.geoapify.com/v2/places?" + placesParams.toString());
    if (!placesRes.ok) throw new Error("Nearby hotel search failed.");
    const places = await placesRes.json();

    const hotels = (places.features || []).map(feature => {
      const p = feature.properties || {};
      const name = clean(p.name);
      return {
        id: p.place_id || `${feature.geometry?.coordinates?.[1]}-${feature.geometry?.coordinates?.[0]}`,
        name,
        address: clean(p.formatted || [p.address_line1, p.address_line2].filter(Boolean).join(", ")),
        lat: feature.geometry?.coordinates?.[1] ?? p.lat,
        lon: feature.geometry?.coordinates?.[0] ?? p.lon,
        distance: Number(p.distance || 0)
      };
    }).filter(h => h.name && HILTON_BRANDS.test(h.name) && Number.isFinite(h.lat) && Number.isFinite(h.lon))
      .sort((a,b) => a.distance - b.distance);

    return json({ center: { lat: center.lat, lon: center.lon, label: clean(center.formatted || q) }, hotels });
  } catch (error) {
    return json({ error: error?.message || "Hilton search failed.", hotels: [] }, 500);
  }
}
