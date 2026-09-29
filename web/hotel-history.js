// Keep hotels available when a traveler moves a stay to another itinerary day.
window.TravonHotelHistory = (() => {
  const key = tripId => "travon.hotels." + tripId;

  function read(tripId) {
    if (!tripId) return [];
    try {
      const entries = JSON.parse(localStorage.getItem(key(tripId)) || "[]");
      return Array.isArray(entries) ? entries : [];
    } catch { return []; }
  }

  function remember(tripId, activities) {
    if (!tripId) return;
    const hotels = read(tripId);
    for (const activity of activities || []) {
      if (activity?.type !== "hotel") continue;
      const title = String(activity.details?.name || activity.title || "").trim();
      if (!title) continue;
      const address = String(activity.details?.address || "").trim();
      const duplicate = hotels.findIndex(hotel => hotel.title.toLowerCase() === title.toLowerCase() && hotel.address.toLowerCase() === address.toLowerCase());
      if (duplicate >= 0) hotels.splice(duplicate, 1);
      hotels.unshift({ title, address, description: address });
    }
    try { localStorage.setItem(key(tripId), JSON.stringify(hotels.slice(0, 50))); } catch {}
  }

  function matches(tripId, query) {
    const tokens = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
    return read(tripId).filter(hotel => tokens.every(token => (hotel.title + " " + hotel.address).toLowerCase().includes(token)));
  }

  function merge(saved, found) {
    const seen = new Set();
    return [...saved, ...found].filter(hotel => {
      const identity = (hotel.title + "|" + (hotel.address || "")).toLowerCase();
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  return { remember, matches, merge };
})();
