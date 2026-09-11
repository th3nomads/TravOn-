(() => {
  const grid = document.querySelector("#tripGrid");
  if (!grid) return;

  function updateLabels() {
    grid.querySelectorAll(".trip-card .tag").forEach(tag => {
      if (tag.textContent?.trim() === "YOUR ITINERARIES") {
        tag.textContent = "YOUR ITINERARY";
      }
    });
  }

  new MutationObserver(updateLabels).observe(grid, { childList: true, subtree: true });
  updateLabels();
})();
