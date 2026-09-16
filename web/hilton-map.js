(() => {
  const tripId = new URLSearchParams(location.search).get("id");
  const mapEl = document.querySelector("#hiltonMap");
  const statusEl = document.querySelector("#hiltonMapStatus");
  if (!tripId || !mapEl || !window.L) return;

  const map = L.map(mapEl, { scrollWheelZoom: false }).setView([39.5, -98.35], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const hotelIcon = L.divIcon({ className: "hilton-h-marker", html: "H", iconSize: [30,30], iconAnchor: [15,30], popupAnchor: [0,-28] });
  const nearestIcon = L.divIcon({ className: "hilton-h-marker nearest", html: "H", iconSize: [38,38], iconAnchor: [19,38], popupAnchor: [0,-36] });
  const bounds = L.latLngBounds();
  const seen = new Set();
  let found = 0;

  const esc = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const miles = meters => meters ? `${(meters / 1609.344).toFixed(meters < 16093 ? 1 : 0)} mi` : "Nearby";

  async function getTrip() {
    try {
      const response = await fetch("/api/trips", { credentials: "same-origin" });
      if (response.ok) {
        const data = await response.json();
        const match = (data.trips || []).find(t => String(t.id) === String(tripId));
        if (match) return match;
      }
    } catch {}
    return (JSON.parse(localStorage.getItem("travon.trips.v2") || "[]")).find(t => String(t.id) === String(tripId));
  }

  function locationText(activity) {
    const d = activity.details || {};
    const candidates = [d.address, d.pickup, d.dropoff, d.name, d.to, d.from, activity.title];
    return candidates.find(v => String(v || "").trim().length > 2) || "";
  }

  async function loadNearby(query) {
    try {
      const res = await fetch("/api/nearby-hiltons?q=" + encodeURIComponent(query));
      if (!res.ok) return;
      const data = await res.json();
      (data.hotels || []).forEach((hotel, index) => {
        const key = hotel.id || `${hotel.lat},${hotel.lon}`;
        if (seen.has(key)) return;
        seen.add(key); found++;
        const marker = L.marker([hotel.lat, hotel.lon], { icon: index === 0 ? nearestIcon : hotelIcon }).addTo(map);
        marker.bindPopup(`<div class="hilton-popup"><strong>${index === 0 ? "Nearest Hilton · " : ""}${esc(hotel.name)}</strong><span>${esc(hotel.address)}</span><small>${esc(miles(hotel.distance))} from this itinerary location</small><button type="button" data-add-hilton="${esc(hotel.name)}" data-address="${esc(hotel.address)}">Add hotel to itinerary</button></div>`);
        bounds.extend([hotel.lat, hotel.lon]);
      });
    } catch {}
  }

  map.on("popupopen", e => {
    const button = e.popup.getElement()?.querySelector("[data-add-hilton]");
    if (!button) return;
    button.addEventListener("click", () => {
      const form = document.querySelector("#activityForm");
      const type = document.querySelector("#activityType");
      if (!form || form.hidden) {
        alert("Select a day in your itinerary first, then tap the Hilton marker again to add it.");
        return;
      }
      type.value = "hotel";
      type.dispatchEvent(new Event("change"));
      document.querySelector("#activityTitle").value = button.dataset.addHilton;
      document.querySelector("#hotelName").value = button.dataset.addHilton;
      document.querySelector("#hotelAddress").value = button.dataset.address;
      map.closePopup();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }, { once: true });
  });

  (async () => {
    statusEl.textContent = "Finding Hilton hotels near your itinerary…";
    const trip = await getTrip();
    const queries = [...new Set((trip?.activities || []).map(locationText).filter(Boolean))].slice(0, 12);
    if (!queries.length) {
      statusEl.textContent = "Add an activity or destination to see nearby Hilton hotels.";
      return;
    }
    await Promise.all(queries.map(loadNearby));
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
    statusEl.textContent = found ? `${found} Hilton ${found === 1 ? "hotel" : "hotels"} found near your itinerary. Tap an H for details.` : "No Hilton hotels found within 25 km of the current itinerary locations.";
    setTimeout(() => map.invalidateSize(), 100);
  })();
})();
