const WIKI = "https://en.wikipedia.org/w/api.php";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=21600",
      ...headers
    }
  });
}

function params(obj) {
  const qs = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => qs.set(key, String(value)));
  return qs.toString();
}

function classify(title, extract) {
  const text = (title + " " + extract).toLowerCase();
  if (/park|mount|mountain|garden|trail|island|beach|river|lake|forest|outdoor/.test(text)) return "Outdoor";
  if (/market|food|restaurant|cuisine|bakery|café|cafe/.test(text)) return "Food";
  if (/museum|gallery|art|theatre|theater/.test(text)) return "Culture";
  if (/historic|history|old |cathedral|church|basilica|fort|monument|heritage|castle/.test(text)) return "Historic";
  return "Explore";
}

function cleanDescription(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "A notable place to explore nearby.";
  if (value.length <= 170) return value;
  return value.slice(0, 167).trimEnd() + "...";
}

async function wikiFetch(query) {
  const response = await fetch(WIKI + "?" + query, {
    headers: {
      "User-Agent": "TravOn/1.0 (https://travon.pages.dev)",
      "Api-User-Agent": "TravOn/1.0 (https://travon.pages.dev)"
    }
  });
  if (!response.ok) throw new Error("Wikipedia request failed.");
  return response.json();
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 2 || q.length > 80) {
      return json({ error: "Enter a city or destination." }, 400);
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const search = await wikiFetch(params({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: q,
      gsrlimit: 8,
      prop: "coordinates|pageimages|extracts|info",
      exintro: 1,
      explaintext: 1,
      exsentences: 2,
      inprop: "url",
      piprop: "thumbnail",
      pithumbsize: 640,
      redirects: 1
    }));

    const searchPages = Object.values(search?.query?.pages || {})
      .sort((a, b) => (a.index || 999) - (b.index || 999));
    const anchor = searchPages.find(page => page.coordinates?.[0]);
    if (!anchor) return json({ query: q, places: [] });

    const coord = anchor.coordinates[0];
    const nearby = await wikiFetch(params({
      action: "query",
      format: "json",
      generator: "geosearch",
      ggscoord: coord.lat + "|" + coord.lon,
      ggsradius: 10000,
      ggslimit: 18,
      prop: "coordinates|pageimages|extracts|info",
      exintro: 1,
      explaintext: 1,
      exsentences: 2,
      inprop: "url",
      piprop: "thumbnail",
      pithumbsize: 640
    }));

    const places = Object.values(nearby?.query?.pages || {})
      .filter(page => page.title && page.title !== anchor.title)
      .map(page => ({
        id: String(page.pageid),
        title: page.title,
        description: cleanDescription(page.extract),
        type: classify(page.title, page.extract || ""),
        image: page.thumbnail?.source || null,
        lat: page.coordinates?.[0]?.lat ?? null,
        lon: page.coordinates?.[0]?.lon ?? null,
        url: page.fullurl || null,
        source: "Wikipedia"
      }))
      .filter(place => place.image)
      .slice(0, 8);

    const response = json({
      query: q,
      destination: anchor.title,
      center: { lat: coord.lat, lon: coord.lon },
      places
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    return json({ error: error?.message || "Could not load destinations." }, 500, {
      "cache-control": "no-store"
    });
  }
}
