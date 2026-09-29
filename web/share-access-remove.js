(() => {
  const list = document.querySelector("#sharedAccessList");
  if (!list) return;

  function enhancePermissionDropdowns() {
    list.querySelectorAll("select[data-share-access]").forEach(select => {
      if (!select.querySelector('option[value="remove"]')) {
        const option = document.createElement("option");
        option.value = "remove";
        option.textContent = "Remove access";
        select.appendChild(option);
      }
      if (!select.dataset.removeAccessEnhanced) {
        select.dataset.removeAccessEnhanced = "1";
        select.dataset.previousAccess = select.value;
        select.addEventListener("focus", () => {
          if (select.value !== "remove") select.dataset.previousAccess = select.value;
        });
      }
    });
  }

  list.addEventListener("change", async event => {
    const select = event.target.closest?.("select[data-share-access]");
    if (!select || select.value !== "remove") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const row = select.closest(".shared-access-row");
    const personName = row?.querySelector("strong")?.textContent?.trim() || "this person";
    const previousValue = select.dataset.previousAccess || "view";
    const confirmed = window.confirm(`Remove ${personName}'s access to this itinerary? They will no longer be able to view or edit it.`);

    if (!confirmed) {
      select.value = previousValue;
      return;
    }

    select.disabled = true;
    try {
      const response = await fetch("/api/shares", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareId: select.dataset.shareAccess })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not remove access.");
      row?.remove();
      if (!list.querySelector(".shared-access-row")) list.hidden = true;
    } catch (error) {
      select.disabled = false;
      select.value = previousValue;
      alert(error.message || "Could not remove access.");
    }
  }, true);

  const observer = new MutationObserver(enhancePermissionDropdowns);
  observer.observe(list, { childList: true, subtree: true });
  enhancePermissionDropdowns();
})();
