(() => {
  if (window.__travonAdminStatsLoaded) return;
  window.__travonAdminStatsLoaded = true;

  let signedIn = null;
  let adminUsers = [];

  function setLoggedOutGrid(grid, html, marker) {
    if (!grid) return;
    if (grid.dataset.loggedOutState === marker) return;
    grid.innerHTML = html;
    grid.dataset.loggedOutState = marker;
  }

  function clearLoggedOutMarker(grid) {
    if (grid?.dataset?.loggedOutState) delete grid.dataset.loggedOutState;
  }

  function closeUserPanel() {
    document.querySelector("#travonAdminUsersOverlay")?.remove();
  }

  function formatSignupDate(value) {
    if (!value) return "Signup date unavailable";
    const parsed = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function openUserPanel() {
    closeUserPanel();

    const overlay = document.createElement("div");
    overlay.id = "travonAdminUsersOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "1000";
    overlay.style.background = "rgba(15,23,42,.55)";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.padding = "18px";

    const panel = document.createElement("section");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "TravOn registered users");
    panel.style.width = "min(680px, 100%)";
    panel.style.maxHeight = "82vh";
    panel.style.overflow = "hidden";
    panel.style.background = "#fff";
    panel.style.borderRadius = "22px";
    panel.style.boxShadow = "0 28px 80px rgba(15,23,42,.28)";
    panel.style.display = "grid";
    panel.style.gridTemplateRows = "auto 1fr";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.gap = "12px";
    header.style.padding = "18px 20px";
    header.style.borderBottom = "1px solid #e7ebef";

    const heading = document.createElement("div");
    heading.innerHTML = `<div style="font-size:12px;font-weight:900;letter-spacing:.12em;color:#0b8d97">ADMIN</div><h2 style="margin:3px 0 0;font-size:22px">Registered TravOn Users</h2><p style="margin:5px 0 0;color:#667085;font-size:13px">${adminUsers.length} total signup${adminUsers.length === 1 ? "" : "s"}</p>`;

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close user list");
    close.style.width = "40px";
    close.style.height = "40px";
    close.style.border = "0";
    close.style.borderRadius = "50%";
    close.style.background = "#f3f6f7";
    close.style.fontSize = "24px";
    close.style.cursor = "pointer";
    close.addEventListener("click", closeUserPanel);

    header.append(heading, close);

    const list = document.createElement("div");
    list.style.overflowY = "auto";
    list.style.padding = "8px 20px 20px";

    if (!adminUsers.length) {
      list.innerHTML = '<div style="padding:24px 0;color:#667085">No registered users yet.</div>';
    } else {
      adminUsers.forEach((user, index) => {
        const row = document.createElement("div");
        row.style.padding = "14px 0";
        row.style.borderBottom = index === adminUsers.length - 1 ? "0" : "1px solid #eef1f3";

        const name = document.createElement("strong");
        name.textContent = user.name || "Unnamed user";
        name.style.display = "block";
        name.style.fontSize = "15px";

        const email = document.createElement("div");
        email.textContent = user.email || "No email";
        email.style.marginTop = "3px";
        email.style.color = "#475467";
        email.style.fontSize = "14px";
        email.style.overflowWrap = "anywhere";

        const date = document.createElement("div");
        date.textContent = formatSignupDate(user.createdAt);
        date.style.marginTop = "5px";
        date.style.color = "#98a2b3";
        date.style.fontSize = "12px";

        row.append(name, email, date);
        list.appendChild(row);
      });
    }

    panel.append(header, list);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeUserPanel();
    });
    document.body.appendChild(overlay);
  }

  function loggedOutTripState() {
    const tripGrid = document.querySelector("#tripGrid");
    setLoggedOutGrid(
      tripGrid,
      '<div class="empty-state"><h3>Log in to view your trips</h3><p>Your saved and shared Itineraries will appear here after you sign in.</p></div>',
      "trips"
    );

    const friendsGrid = document.querySelector("#friendsGrid");
    setLoggedOutGrid(
      friendsGrid,
      '<div class="empty-state"><div class="empty-icon">👥</div><h3>Log in to see shared trips</h3><p>Your TravOn friends and shared Itineraries will appear here after you sign in.</p></div>',
      "friends"
    );

    const plannerPage = document.querySelector("#plannerPage");
    if (plannerPage) plannerPage.hidden = true;

    document.querySelector("#adminUserCount")?.remove();
    closeUserPanel();
  }

  function enforceLoggedOutPrivacy() {
    if (signedIn === false) loggedOutTripState();
  }

  async function checkSession() {
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      signedIn = !!data?.user;
      if (signedIn) {
        clearLoggedOutMarker(document.querySelector("#tripGrid"));
        clearLoggedOutMarker(document.querySelector("#friendsGrid"));
      } else {
        enforceLoggedOutPrivacy();
      }
    } catch {
      signedIn = false;
      enforceLoggedOutPrivacy();
    }
  }

  async function loadAdminStats() {
    try {
      const response = await fetch("/api/admin-stats", { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json();
      const totalUsers = Number(data?.totalUsers);
      if (!Number.isFinite(totalUsers)) return;
      adminUsers = Array.isArray(data?.users) ? data.users : [];

      const greeting = document.querySelector("#loggedInGreeting");
      if (!greeting) return;

      let badge = document.querySelector("#adminUserCount");
      if (!badge) {
        badge = document.createElement("button");
        badge.id = "adminUserCount";
        badge.type = "button";
        badge.setAttribute("aria-label", "View registered TravOn users");
        badge.style.display = "inline-flex";
        badge.style.alignItems = "center";
        badge.style.marginLeft = "10px";
        badge.style.padding = "5px 10px";
        badge.style.border = "0";
        badge.style.borderRadius = "999px";
        badge.style.fontSize = "12px";
        badge.style.fontWeight = "800";
        badge.style.background = "#e8f8f8";
        badge.style.color = "#138f95";
        badge.style.cursor = "pointer";
        badge.addEventListener("click", openUserPanel);
        greeting.appendChild(badge);
      }
      badge.textContent = `Total Users: ${totalUsers} · View`;
    } catch {}
  }

  function watchLogoutState() {
    const signupButton = document.querySelector("#signupButton");
    const heroLoginButton = document.querySelector("#heroLoginButton");

    const evaluate = () => {
      const desktopAction = signupButton?.dataset?.action;
      const heroAction = heroLoginButton?.dataset?.action;
      if (desktopAction === "logout" || heroAction === "logout") {
        signedIn = true;
        clearLoggedOutMarker(document.querySelector("#tripGrid"));
        clearLoggedOutMarker(document.querySelector("#friendsGrid"));
        return;
      }
      if (desktopAction === "signup" || heroAction === "login") {
        signedIn = false;
        loggedOutTripState();
      }
    };

    const observer = new MutationObserver(evaluate);
    if (signupButton) observer.observe(signupButton, { attributes: true, attributeFilter: ["data-action"] });
    if (heroLoginButton) observer.observe(heroLoginButton, { attributes: true, attributeFilter: ["data-action"] });
    evaluate();

    const tripGrid = document.querySelector("#tripGrid");
    if (tripGrid) {
      new MutationObserver(() => {
        if (signedIn !== false) return;
        if (tripGrid.dataset.loggedOutState === "trips") return;
        enforceLoggedOutPrivacy();
      }).observe(tripGrid, { childList: true });
    }
  }

  async function init() {
    watchLogoutState();
    await checkSession();
    if (signedIn) await loadAdminStats();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
