(() => {
  const grid = document.querySelector("#tripGrid");
  if (!grid) return;

  let sharedTrips = [];
  let loading = false;

  async function request(path, options = {}) {
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

  function keyFor(title, owner) {
    return `${String(title || "").trim().toLowerCase()}::${String(owner || "").trim().toLowerCase()}`;
  }

  function ownerNameFromCard(card) {
    const text = card.querySelector(".shared-by")?.textContent || "";
    return text.replace(/^Shared by\s+/i, "").trim();
  }

  function installButtons() {
    const pools = new Map();
    sharedTrips
      .slice()
      .sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")))
      .forEach(trip => {
        const key = keyFor(trip.title, trip.ownerName);
        if (!pools.has(key)) pools.set(key, []);
        pools.get(key).push(trip);
      });

    grid.querySelectorAll(".trip-card").forEach(card => {
      const tag = card.querySelector(".tag")?.textContent?.trim();
      if (tag !== "SHARED WITH YOU" || card.querySelector("[data-remove-shared-trip]")) return;

      const title = card.querySelector("h3")?.textContent?.trim() || "";
      const owner = ownerNameFromCard(card);
      const matches = pools.get(keyFor(title, owner)) || [];
      const trip = matches.shift();
      if (!trip) return;

      const shell = card.querySelector(".trip-swipe-shell");
      if (!shell) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "trip-delete-action";
      button.dataset.removeSharedTrip = trip.id;
      button.setAttribute("aria-label", `Remove ${title} from My Trips`);
      button.textContent = "Remove";
      shell.appendChild(button);

      button.addEventListener("click", async event => {
        event.stopPropagation();
        const confirmed = window.confirm(`Remove \"${title}\" from My Trips? The original itinerary will stay with ${owner || "the owner"}.`);
        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Removing…";

        try {
          await request("/api/shares", {
            method: "DELETE",
            body: JSON.stringify({ tripId: trip.id })
          });
          window.location.reload();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
          button.textContent = "Remove";
        }
      });
    });
  }

  async function refreshSharedTrips() {
    if (loading) return;
    loading = true;
    try {
      const data = await request("/api/trips");
      sharedTrips = (data.trips || []).filter(trip => trip.access === "shared");
      installButtons();
    } catch {
      // The regular app handles logged-out and backend-error states.
    } finally {
      loading = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (grid.querySelector('.trip-card .tag')) installButtons();
  });
  observer.observe(grid, { childList: true, subtree: true });

  refreshSharedTrips();
})();
