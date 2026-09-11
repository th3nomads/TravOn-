(() => {
  async function loadAdminStats() {
    try {
      const response = await fetch("/api/admin-stats", { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json();
      const totalUsers = Number(data?.totalUsers);
      if (!Number.isFinite(totalUsers)) return;

      const greeting = document.querySelector("#loggedInGreeting");
      if (!greeting) return;

      let badge = document.querySelector("#adminUserCount");
      if (!badge) {
        badge = document.createElement("span");
        badge.id = "adminUserCount";
        badge.setAttribute("aria-label", "Total registered TravOn users");
        badge.style.display = "inline-flex";
        badge.style.alignItems = "center";
        badge.style.marginLeft = "10px";
        badge.style.padding = "4px 9px";
        badge.style.borderRadius = "999px";
        badge.style.fontSize = "12px";
        badge.style.fontWeight = "700";
        badge.style.background = "#e8f8f8";
        badge.style.color = "#138f95";
        greeting.appendChild(badge);
      }
      badge.textContent = `Total Users: ${totalUsers}`;
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAdminStats, { once: true });
  } else {
    loadAdminStats();
  }
})();
