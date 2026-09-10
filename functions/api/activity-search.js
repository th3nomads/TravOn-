function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function typeHint(type) {
  return ({
    hotel: "hotel",
    airport: "airport",
    restaurant: "restaurant",
    car_rental: "car rental",
    activity: "",
    custom: ""
  })[type] || "";
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.GEOAPIFY_API_KEY) {
      return json({ error: "Geoapify is not configured yet.", results: [] }, 503);
    }

    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q"));
    const type = clean(url.searchParams.get("type"));

    if (q.length < 2 || q.length > 120) {
      return json({ results: [] });
    }

    const params = new URLSearchParams({
      text: q,
      format: "json",
      lang: "en",
      limit: "20",
      apiKey: env.GEOAPIFY_API_KEY
    });

    const response = await fetch("https://api.geoapify.com/v1/geocode/search?" + params.toString());

    if (!response.ok) {
      throw new Error("Place lookup failed.");
    }

    const data = await response.json();
    const queryTokens = q.toLowerCase().split(/\s+/).filter(token => token.length > 2);

    const results = (data.results || []).map((place, index) => {
      const title =
        clean(place.name) ||
        clean(place.address_line1) ||
        clean(place.formatted) ||
        clean(q);

      const descriptionParts = [
        place.address_line2,
        place.city,
        place.state,
        place.country
      ].map(clean).filter(Boolean);

      const haystack = [place.name, place.address_line1, place.address_line2, place.city, place.state, place.country, place.formatted]
        .map(clean).join(" ").toLowerCase();
      const normalizedQuery = q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const normalizedName = clean(place.name || place.address_line1).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const tokenScore = queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      const exactNameBonus = normalizedName === normalizedQuery ? 100 : (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName) ? 30 : 0);
      const hotelBonus = type === "hotel" && /hotel|doubletree|hilton/.test(haystack) ? 8 : 0;
      const confidenceBonus = Number(place.rank?.confidence || 0) * 5;
      const matchScore = tokenScore + exactNameBonus + hotelBonus + confidenceBonus;

      return {
        id: place.place_id || String(index),
        matchScore,
        title,
        description: descriptionParts.join(", ") || clean(place.formatted),
        address: clean(place.formatted),
        city: clean(place.city),
        state: clean(place.state),
        country: clean(place.country),
        postcode: clean(place.postcode),
        lat: place.lat ?? null,
        lon: place.lon ?? null,
        category: type || "activity",
        image: null
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    return json({ results: results.slice(0, 8) });
  } catch (error) {
    return json({ error: error?.message || "Place lookup failed.", results: [] }, 500);
  }
}
