(() => {
  let signedIn = null;

  function setLoggedOutGrid(grid, html, marker) {
    if (!grid) return;
    if (grid.dataset.loggedOutState === marker) return;
    grid.innerHTML = html;
    grid.dataset.loggedOutState = marker;
  }

  function clearLoggedOutMarker(grid) {
    if (grid?.dataset?.loggedOutState) delete grid.dataset.loggedOutState;
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

    const badge = document.querySelector("#adminUserCount");
    if (badge) badge.remove();
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
