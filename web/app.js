const starterTrips = [
  {
    id: crypto.randomUUID(),
    title: "Weekend Getaway",
    startDate: "2026-10-02",
    endDate: "2026-10-04",
    shared: 1,
    activities: [
      { id: crypto.randomUUID(), date: "2026-10-02", time: "18:00", title: "Hotel check-in" },
      { id: crypto.randomUUID(), date: "2026-10-03", time: "10:00", title: "Explore downtown" }
    ]
  }
];

const starterPlaces = [
  { title: "Old Montreal", description: "Historic streets, cafés, and architecture.", type: "Historic", scene: "old" },
  { title: "Mount Royal", description: "Scenic city views and walking trails.", type: "Outdoor", scene: "mount" },
  { title: "Jean-Talon Market", description: "Local food, produce, and neighborhood vibe.", type: "Food", scene: "market" }
];

let trips = JSON.parse(localStorage.getItem("travon.trips.v2") || "null") || starterTrips;
let discoveryPlaces = starterPlaces.slice();
let discoverTimer = null;
let activeTripId = null;
let activePlannerDate = null;
let authMode = "signup";
let currentUser = null;
let backendConfigured = false;

let splitzState = JSON.parse(localStorage.getItem("travon.splitz.v1") || "null") || { groups: [], activeGroupId: null };

function saveSplitzState() {
  localStorage.setItem("travon.splitz.v1", JSON.stringify(splitzState));
}

function activeSplitzGroup() {
  return splitzState.groups.find(group => group.id === splitzState.activeGroupId) || null;
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
}

function calculateSplitz(group) {
  const balances = Object.fromEntries((group.people || []).map(person => [person.id, 0]));
  (group.expenses || []).forEach(expense => {
    const people = group.people || [];
    if (!people.length) return;
    const share = Number(expense.amount) / people.length;
    people.forEach(person => { balances[person.id] = (balances[person.id] || 0) - share; });
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + Number(expense.amount);
  });

  const creditors = Object.entries(balances).filter(([,v]) => v > 0.005).map(([id,v]) => ({id,amount:v})).sort((a,b)=>b.amount-a.amount);
  const debtors = Object.entries(balances).filter(([,v]) => v < -0.005).map(([id,v]) => ({id,amount:-v})).sort((a,b)=>b.amount-a.amount);
  const settlements = [];
  let c = 0, d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c].amount, debtors[d].amount);
    if (amount > 0.005) settlements.push({ from: debtors[d].id, to: creditors[c].id, amount });
    creditors[c].amount -= amount;
    debtors[d].amount -= amount;
    if (creditors[c].amount < 0.005) c++;
    if (debtors[d].amount < 0.005) d++;
  }
  return { balances, settlements };
}

function renderSplitz() {
  if (!splitzGroupSelect) return;

  if (!splitzState.activeGroupId && splitzState.groups.length) splitzState.activeGroupId = splitzState.groups[0].id;
  const group = activeSplitzGroup();

  splitzGroupSelect.innerHTML = splitzState.groups.length
    ? splitzState.groups.map(item => '<option value="' + item.id + '"' + (item.id === splitzState.activeGroupId ? ' selected' : '') + '>' + escapeHtml(item.name) + '</option>').join("")
    : '<option value="">No groups yet</option>';
  splitzGroupSelect.disabled = !splitzState.groups.length;

  splitzEmpty.hidden = !!group;
  splitzWorkspace.hidden = !group;
  if (!group) return;

  group.people ||= [];
  group.expenses ||= [];

  splitzPeople.innerHTML = group.people.length
    ? group.people.map(person => '<span class="splitz-person-chip">' + escapeHtml(person.name) + '<button type="button" data-remove-splitz-person="' + person.id + '" aria-label="Remove ' + escapeHtml(person.name) + '">×</button></span>').join("")
    : '<p class="splitz-muted">Add at least two people to start splitting expenses.</p>';

  splitzPaidBy.innerHTML = group.people.map(person => '<option value="' + person.id + '">' + escapeHtml(person.name) + '</option>').join("");
  splitzPaidBy.disabled = !group.people.length;

  const { balances, settlements } = calculateSplitz(group);
  const nameFor = id => group.people.find(person => person.id === id)?.name || "Friend";

  splitzBalances.innerHTML = group.people.length
    ? group.people.map(person => {
        const amount = balances[person.id] || 0;
        const status = amount > 0.005 ? "gets back" : amount < -0.005 ? "owes" : "is settled";
        return '<div class="splitz-balance-row"><strong>' + escapeHtml(person.name) + '</strong><span class="' + (amount > 0.005 ? 'positive' : amount < -0.005 ? 'negative' : '') + '">' + status + (Math.abs(amount) > 0.005 ? ' ' + money(Math.abs(amount)) : '') + '</span></div>';
      }).join("")
    : '<p class="splitz-muted">Add people to calculate balances.</p>';

  splitzSettlements.innerHTML = settlements.length
    ? '<div class="splitz-settlement-title">Suggested payments</div>' + settlements.map(item => '<div class="splitz-settlement"><strong>' + escapeHtml(nameFor(item.from)) + '</strong><span>pays</span><strong>' + escapeHtml(nameFor(item.to)) + '</strong><b>' + money(item.amount) + '</b></div>').join("")
    : (group.expenses.length ? '<div class="splitz-all-set">✓ Everyone is settled up</div>' : '');

  splitzExpenses.innerHTML = group.expenses.length
    ? group.expenses.slice().reverse().map(expense => '<div class="splitz-expense-row"><div><strong>' + escapeHtml(expense.title) + '</strong><small>Paid by ' + escapeHtml(nameFor(expense.paidBy)) + '</small></div><span>' + money(expense.amount) + '</span><button type="button" data-remove-splitz-expense="' + expense.id + '" aria-label="Delete expense">×</button></div>').join("")
    : '<p class="splitz-muted">No expenses yet.</p>';

  splitzPeople.querySelectorAll("[data-remove-splitz-person]").forEach(button => button.addEventListener("click", () => {
    if ((group.expenses || []).some(expense => expense.paidBy === button.dataset.removeSplitzPerson)) {
      alert("Delete this person's expenses first.");
      return;
    }
    group.people = group.people.filter(person => person.id !== button.dataset.removeSplitzPerson);
    saveSplitzState();
    renderSplitz();
  }));

  splitzExpenses.querySelectorAll("[data-remove-splitz-expense]").forEach(button => button.addEventListener("click", () => {
    group.expenses = group.expenses.filter(expense => expense.id !== button.dataset.removeSplitzExpense);
    saveSplitzState();
    renderSplitz();
  }));
}


async function api(path, options = {}) {
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

async function loadSession() {
  try {
    const data = await api("/api/auth/me");
    backendConfigured = data.configured !== false;
    currentUser = data.user || null;
    updateAuthUI();
    if (currentUser) {
      await loadTripsFromServer();
      await loadFriends();
    }
    scrollToCurrentHashTarget();
  } catch {
    backendConfigured = false;
    updateAuthUI();
    scrollToCurrentHashTarget();
  }
}

async function recoverLocalTrips(serverTrips) {
  if (!currentUser) return serverTrips;
  const raw = localStorage.getItem("travon.trips.v2");
  if (!raw) return serverTrips;

  let localTrips = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) localTrips = parsed;
  } catch {}
  if (!localTrips.length) return serverTrips;

  const migratedKey = "travon.localTripsMigrated." + currentUser.id;
  if (localStorage.getItem(migratedKey) === "1") return serverTrips;

  const matchesExisting = localTrip => serverTrips.some(serverTrip =>
    String(serverTrip.title || "").trim().toLowerCase() === String(localTrip.title || "").trim().toLowerCase() &&
    String(serverTrip.startDate || "") === String(localTrip.startDate || "") &&
    String(serverTrip.endDate || "") === String(localTrip.endDate || "")
  );

  let imported = 0;
  for (const localTrip of localTrips) {
    if (!localTrip?.title || !localTrip?.startDate || !localTrip?.endDate || matchesExisting(localTrip)) continue;
    try {
      const created = await api("/api/trips", {
        method: "POST",
        body: JSON.stringify({
          title: localTrip.title,
          startDate: localTrip.startDate,
          endDate: localTrip.endDate
        })
      });
      const activities = Array.isArray(localTrip.activities) ? localTrip.activities : [];
      if (activities.length && created?.trip?.id) {
        await api("/api/trips", {
          method: "PUT",
          body: JSON.stringify({ id: created.trip.id, activities })
        });
      }
      serverTrips.push({ ...created.trip, activities });
      imported++;
    } catch (error) {
      console.warn("Could not recover local itinerary:", localTrip?.title, error);
    }
  }

  if (imported || localTrips.every(matchesExisting)) {
    localStorage.setItem(migratedKey, "1");
  }
  return serverTrips;
}

async function loadTripsFromServer() {
  if (!currentUser) return;
  const data = await api("/api/trips");
  let serverTrips = data.trips || [];
  serverTrips = await recoverLocalTrips(serverTrips);
  trips = serverTrips;
  renderTrips();
  renderFriends([]);
}


function renderFriends(shares = []) {
  if (!friendsGrid) return;
  if (!currentUser) {
    friendsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><h3>Log in to see shared trips</h3><p>Your TravOn friends and the itineraries you shared with them will appear here.</p></div>';
    return;
  }
  if (!shares.length) {
    friendsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><h3>No shared trips yet</h3><p>Open one of your trips and tap Share trip to add someone.</p></div>';
    return;
  }
  const people = new Map();
  shares.forEach(share => {
    const key = share.personId || share.email;
    if (!people.has(key)) people.set(key,{name:share.name || "TravOn friend", trips:[]});
    people.get(key).trips.push(share);
  });
  friendsGrid.innerHTML = [...people.values()].map(person => `
    <article class="friend-card">
      <div class="friend-avatar">${escapeHtml((person.name || "?").trim().charAt(0).toUpperCase())}</div>
      <div class="friend-copy">
        <h3>${escapeHtml(person.name)}</h3>
        <div class="friend-trips">
          ${person.trips.map(item => `<div class="friend-trip"><div><strong>${escapeHtml(item.tripTitle)}</strong><small>${item.direction === "incoming" ? "Shared with you" : "You shared this trip"}</small></div><span>${formatDate(item.startDate)} – ${formatDate(item.endDate)}</span></div>`).join("")}
        </div>
      </div>
    </article>`).join("");
}

async function loadFriends() {
  if (!currentUser) return renderFriends([]);
  try {
    const data = await api("/api/shares");
    renderFriends(data.shares || []);
  } catch {
    renderFriends([]);
  }
}

function updateAuthUI() {
  const signup = document.querySelector("#signupButton");
  const login = document.querySelector("#loginButton");
  const heroSignup = document.querySelector("#heroSignupButton");
  const heroLogin = document.querySelector("#heroLoginButton");
  const loggedInGreeting = document.querySelector("#loggedInGreeting");
  const loggedInName = document.querySelector("#loggedInName");
  if (loggedInGreeting && loggedInName) {
    loggedInGreeting.hidden = !currentUser;
    loggedInName.textContent = currentUser?.name || "";
  }

  if (currentUser) {
    if (signup) { signup.textContent = "Log out"; signup.dataset.action = "logout"; }
    if (login) { login.textContent = "My Trips"; login.disabled = false; login.dataset.action = "trips"; }
    if (heroSignup) { heroSignup.textContent = "My Trips"; heroSignup.dataset.action = "trips"; }
    if (heroLogin) { heroLogin.textContent = "Log out"; heroLogin.disabled = false; heroLogin.dataset.action = "logout"; }
  } else {
    if (signup) { signup.textContent = "Create account"; signup.dataset.action = "signup"; }
    if (login) { login.textContent = "Log in"; login.disabled = false; login.dataset.action = "login"; }
    if (heroSignup) { heroSignup.textContent = "Create Account"; heroSignup.dataset.action = "signup"; }
    if (heroLogin) { heroLogin.textContent = "Log In"; heroLogin.disabled = false; heroLogin.dataset.action = "login"; }
  }
}

async function logout() {
  try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch {}
  currentUser = null;
  trips = JSON.parse(localStorage.getItem("travon.trips.v2") || "null") || starterTrips;
  updateAuthUI();
  renderTrips();
}

const tripGrid = document.querySelector("#tripGrid");
const friendsGrid = document.querySelector("#friendsGrid");
const placeGrid = document.querySelector("#placeGrid");
const tripDialog = document.querySelector("#tripDialog");
const tripForm = document.querySelector("#tripForm");
const plannerPage = document.querySelector("#plannerPage");
const plannerDays = document.querySelector("#plannerDays");
const plannerTitle = document.querySelector("#plannerTitle");
const plannerDates = document.querySelector("#plannerDates");
const activityForm = document.querySelector("#activityForm");
const activityDay = document.querySelector("#activityDay");
const activityType = document.querySelector("#activityType");
const activityLookup = document.querySelector("#activityLookup");
const activityLookupResults = document.querySelector("#activityLookupResults");
let activityLookupTimer = null;
const authDialog = document.querySelector("#authDialog");
const authForm = document.querySelector("#authForm");
const placeSearch = document.querySelector("#placeSearch");
const nav = document.querySelector(".nav");

const splitzGroupSelect = document.querySelector("#splitzGroupSelect");
const splitzGroupForm = document.querySelector("#splitzGroupForm");
const splitzGroupName = document.querySelector("#splitzGroupName");
const splitzEmpty = document.querySelector("#splitzEmpty");
const splitzWorkspace = document.querySelector("#splitzWorkspace");
const splitzPersonForm = document.querySelector("#splitzPersonForm");
const splitzPersonName = document.querySelector("#splitzPersonName");
const splitzPeople = document.querySelector("#splitzPeople");
const splitzExpenseForm = document.querySelector("#splitzExpenseForm");
const splitzExpenseTitle = document.querySelector("#splitzExpenseTitle");
const splitzExpenseAmount = document.querySelector("#splitzExpenseAmount");
const splitzPaidBy = document.querySelector("#splitzPaidBy");
const splitzBalances = document.querySelector("#splitzBalances");
const splitzSettlements = document.querySelector("#splitzSettlements");
const splitzExpenses = document.querySelector("#splitzExpenses");


async function saveTrips() {
  if (!currentUser) {
    localStorage.setItem("travon.trips.v2", JSON.stringify(trips));
    return;
  }
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  try {
    await api("/api/trips", {
      method: "PUT",
      body: JSON.stringify({ id: trip.id, activities: trip.activities || [] })
    });
  } catch (error) {
    alert(error.message);
  }
}

function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", options).format(new Date(value + "T12:00:00"));
}

function dateRange(start, end) {
  const dates = [];
  const cursor = new Date(start + "T12:00:00");
  const finish = new Date(end + "T12:00:00");
  while (cursor <= finish) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function renderTrips() {
  tripGrid.innerHTML = "";
  if (!trips.length) {
    tripGrid.innerHTML = '<div class="empty-state"><h3>No itineraries yet</h3><p>Create your first trip to get started.</p></div>';
    return;
  }

  trips
    .slice()
    .sort((a,b) => a.startDate.localeCompare(b.startDate))
    .forEach(trip => {
      const card = document.createElement("article");
      card.className = "card clickable trip-card";
      const activityCount = (trip.activities || []).length;
      card.innerHTML = `
        <div class="trip-swipe-shell">
          <div class="trip-swipe-content">
            <span class="tag">${trip.access === "shared" ? "SHARED WITH YOU" : "YOUR ITINERARIES"}</span>
            <h3>${escapeHtml(trip.title)}</h3>
            ${trip.access === "shared" ? `<p class="shared-by">Shared by ${escapeHtml(trip.ownerName || "TravOn user")}</p>` : ""}
            <p>${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}</p>
            <div class="card-meta">
              <span>${activityCount} activit${activityCount === 1 ? "y" : "ies"}</span>
              <span>Open planner →</span>
            </div>
          </div>
          ${trip.access === "shared" ? "" : `<button type="button" class="trip-delete-action" data-remove-trip="${trip.id}" aria-label="Delete ${escapeHtml(trip.title)} itinerary">Delete</button>`}
        </div>
      `;
      const swipeContent = card.querySelector(".trip-swipe-content");
      const deleteButton = card.querySelector("[data-remove-trip]");
      let touchStartX = 0;
      let touchStartY = 0;
      let swiping = false;
      let revealed = false;
      let suppressClick = false;

      function setSwipe(open) {
        revealed = open;
        swipeContent.style.transform = open ? "translateX(-92px)" : "translateX(0)";
        card.classList.toggle("delete-revealed", open);
      }

      swipeContent.addEventListener("touchstart", (event) => {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        swiping = false;
      }, { passive: true });

      swipeContent.addEventListener("touchmove", (event) => {
        const touch = event.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          swiping = true;
        }
      }, { passive: true });

      swipeContent.addEventListener("touchend", (event) => {
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        if (swiping) {
          suppressClick = true;
          if (dx < -45) setSwipe(true);
          else if (dx > 35) setSwipe(false);
          setTimeout(() => { suppressClick = false; }, 250);
        }
      });

      swipeContent.addEventListener("click", () => {
        if (suppressClick) return;
        if (revealed) {
          setSwipe(false);
          return;
        }
        openPlanner(trip.id);
      });

      if (deleteButton) deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const confirmed = window.confirm('Delete "' + trip.title + '"? This will permanently remove the itinerary and its activities.');
        if (!confirmed) {
          setSwipe(false);
          return;
        }

        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting…";

        try {
          if (currentUser) {
            await api("/api/trips", {
              method: "DELETE",
              body: JSON.stringify({ id: trip.id })
            });
          }

          trips = trips.filter(item => item.id !== trip.id);
          if (!currentUser) localStorage.setItem("travon.trips.v2", JSON.stringify(trips));
          renderTrips();
        } catch (error) {
          alert(error.message);
          deleteButton.disabled = false;
          deleteButton.textContent = "Delete";
          setSwipe(false);
        }
      });

      tripGrid.appendChild(card);
    });
}

function renderPlaces() {
  placeGrid.innerHTML = "";
  if (!discoveryPlaces.length) {
    placeGrid.innerHTML = '<div class="empty-state"><h3>No places found</h3><p>Try another city or destination.</p></div>';
    return;
  }

  discoveryPlaces.forEach(place => {
    const card = document.createElement("article");
    card.className = "destination-card";
    const tagClass = String(place.type || "Explore").toLowerCase();
    const image = place.image
      ? `<img class="destination-photo" src="${escapeHtml(place.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : `<div class="destination-image scene-${place.scene || "mount"}" aria-hidden="true"></div>`;

    card.innerHTML = `
      <div class="destination-media">${image}</div>
      <div class="destination-copy">
        <span class="bookmark" aria-hidden="true">♡</span>
        <span class="tag ${tagClass}">${escapeHtml(place.type || "Explore")}</span>
        <h3>${escapeHtml(place.title)}</h3>
        <p>${escapeHtml(place.description || "A notable place to explore nearby.")}</p>
      </div>
    `;

    if (place.url) {
      card.addEventListener("click", () => window.open(place.url, "_blank", "noopener"));
      card.classList.add("clickable");
    }
    placeGrid.appendChild(card);
  });
}

async function discoverPlaces(query) {
  const q = String(query || "").trim();
  if (q.length < 2) {
    discoveryPlaces = starterPlaces.slice();
    renderPlaces();
    return;
  }

  placeGrid.innerHTML = '<div class="discovery-loading">Finding places near <strong>' + escapeHtml(q) + '</strong>…</div>';

  try {
    const data = await api("/api/discover?q=" + encodeURIComponent(q), { method: "GET", headers: {} });
    discoveryPlaces = Array.isArray(data.places) && data.places.length ? data.places : starterPlaces.slice();
    renderPlaces();
  } catch (error) {
    discoveryPlaces = starterPlaces.slice();
    renderPlaces();
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  document.querySelector("#authTitle").textContent = isSignup ? "Create your account" : "Welcome back";
  document.querySelector("#authCopy").textContent = isSignup
    ? "Name, email, and password are required."
    : "Log in to access your TravOn trips.";
  const nameLabel = document.querySelector("#authNameLabel");
  const nameInput = document.querySelector("#authName");
  if (nameLabel) {
    nameLabel.hidden = !isSignup;
    nameLabel.classList.toggle("is-hidden", !isSignup);
  }
  if (nameInput) {
    nameInput.required = isSignup;
    nameInput.disabled = !isSignup;
    if (!isSignup) nameInput.value = "";
  }
  document.querySelector("#authSubmit").textContent = isSignup ? "Create account" : "Log in";
  document.querySelector("#authSwitch").textContent = isSignup
    ? "Already have an account? Log in"
    : "New to TravOn? Create account";
  document.querySelector("#authNote").hidden = !isSignup;
  document.querySelector("#authPassword").autocomplete = isSignup ? "new-password" : "current-password";
}

function openDialogSafe(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialogSafe(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function openAuth(mode) {
  setAuthMode(mode);
  authForm.reset();
  openDialogSafe(authDialog);
}

function openTripForm() {
  tripForm.reset();
  openDialogSafe(tripDialog);
}

function openPlanner(tripId) {
  window.location.href = "./planner.html?id=" + encodeURIComponent(tripId);
}

function closePlannerPage() {
  plannerPage.hidden = true;
  document.body.classList.remove("planner-page-open");
  activePlannerDate = null;
  activityForm.hidden = true;
  resetActivityLookup();
  document.querySelector("#itineraries")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function activityTypeLabel(type) {
  return ({activity:"Activity",flight:"Flight",airport:"Airport",hotel:"Hotel",car_rental:"Car Rental",restaurant:"Restaurant",custom:"Custom"})[type] || "Activity";
}

function activityDetailsHtml(activity) {
  const d = activity.details || {};
  const rows = [];
  const add = (label, value) => { if (value) rows.push('<div><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value) + '</div>'); };
  if (activity.type === "flight") { add("Airline",d.airline); add("Flight",d.flightNumber); add("From",d.from); add("To",d.to); add("Confirmation",d.confirmation); }
  if (activity.type === "airport") { add("Airport",d.name); add("Code",d.code); add("Terminal / gate",d.terminal); }
  if (activity.type === "hotel") { add("Hotel",d.name); add("Address",d.address); add("Confirmation",d.confirmation); add("Check-in",d.checkin); }
  if (activity.type === "car_rental") { add("Rental company",d.company); add("Pickup",d.pickup); add("Drop-off",d.dropoff); add("Confirmation",d.confirmation); }
  if (activity.type === "restaurant") { add("Restaurant",d.name); add("Address",d.address); add("Reservation",d.reservation); }
  add("Notes",activity.notes);
  return rows.length ? '<div class="activity-details">' + rows.join("") + '</div>' : "";
}

function updateActivityFields() {
  ["flightFields","airportFields","hotelFields","carFields","restaurantFields"].forEach(id => {
    const el = document.querySelector("#" + id);
    if (el) el.hidden = true;
  });
  const map = {flight:"flightFields",airport:"airportFields",hotel:"hotelFields",car_rental:"carFields",restaurant:"restaurantFields"};
  if (map[activityType.value]) document.querySelector("#" + map[activityType.value]).hidden = false;
}

function resetActivityLookup() {
  clearTimeout(activityLookupTimer);
  activityLookup.value = "";
  activityLookupResults.innerHTML = "";
  activityLookupResults.hidden = true;
}

async function searchActivities(query) {
  const q = String(query || "").trim();
  if (q.length < 2) { activityLookupResults.hidden = true; activityLookupResults.innerHTML = ""; return; }
  activityLookupResults.hidden = false;
  activityLookupResults.innerHTML = '<div class="lookup-status">Searching…</div>';
  try {
    const trip = trips.find(t => t.id === activeTripId);
    const context = trip?.title || "";
    const data = await api("/api/activity-search?q=" + encodeURIComponent(q) + "&type=" + encodeURIComponent(activityType.value) + "&context=" + encodeURIComponent(context), { method:"GET", headers:{} });
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) { activityLookupResults.innerHTML = '<div class="lookup-status">No matches found. You can still type it manually below.</div>'; return; }
    activityLookupResults.innerHTML = results.map((result,index) =>
      '<button type="button" class="lookup-result" data-lookup-index="' + index + '">' +
      (result.image ? '<img src="' + escapeHtml(result.image) + '" alt="" loading="lazy" />' : '<span class="lookup-placeholder">⌖</span>') +
      '<span><strong>' + escapeHtml(result.title) + '</strong><small>' + escapeHtml(result.description || "") + '</small></span></button>'
    ).join("");
    activityLookupResults.querySelectorAll("[data-lookup-index]").forEach(button => button.addEventListener("click", () => {
      const result = results[Number(button.dataset.lookupIndex)];
      document.querySelector("#activityTitle").value = result.title;

      if (activityType.value === "hotel") {
        document.querySelector("#hotelName").value = result.title || "";
        document.querySelector("#hotelAddress").value = result.address || result.description || "";
      } else if (activityType.value === "airport") {
        document.querySelector("#airportName").value = result.title || "";
      } else if (activityType.value === "restaurant") {
        document.querySelector("#restaurantName").value = result.title || "";
        document.querySelector("#restaurantAddress").value = result.address || result.description || "";
      } else if (activityType.value === "car_rental") {
        document.querySelector("#carPickup").value = result.address || result.description || "";
      }

      updateActivityFields();

      resetActivityLookup();
      activityLookup.blur();
    }));
  } catch (error) {
    activityLookupResults.innerHTML = '<div class="lookup-status">' + escapeHtml(error.message || "Lookup is unavailable right now.") + ' You can still type the details manually.</div>';
  }
}

function renderPlanner() {
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;

  plannerTitle.textContent = trip.title;
  plannerDates.textContent = `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`;
  plannerDays.innerHTML = "";
  activityDay.innerHTML = "";

  dateRange(trip.startDate, trip.endDate).forEach((date, index) => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = `Day ${index + 1} · ${formatDate(date, { weekday: "short", month: "short", day: "numeric" })}`;
    activityDay.appendChild(option);

    const day = document.createElement("section");
    day.className = "planner-day" + (activePlannerDate === date ? " active" : "");
    day.dataset.plannerDate = date;
    const dayActivities = (trip.activities || [])
      .filter(activity => activity.date === date)
      .sort((a,b) => a.time.localeCompare(b.time));

    day.innerHTML = `
      <div class="planner-day-heading">
        <h3>Day ${index + 1} · ${formatDate(date, { weekday: "long", month: "long", day: "numeric" })}</h3>
        <span class="day-add-hint">${activePlannerDate === date ? "Adding here" : "Tap to add +"}</span>
      </div>
      <div class="activity-list">
        ${dayActivities.length ? dayActivities.map(activity => `
          <div class="activity">
            <span class="activity-time">${formatTime(activity.time)}</span>
            <span class="activity-main">
              <span class="activity-kind">${activityTypeLabel(activity.type)}</span>
              <strong>${escapeHtml(activity.title)}</strong>
              ${activityDetailsHtml(activity)}
            </span>
            <button type="button" data-delete-activity="${activity.id}" aria-label="Delete activity">×</button>
          </div>
        `).join("") : '<span class="day-empty">No activities yet.</span>'}
      </div>
    `;
    plannerDays.appendChild(day);
  });

  plannerDays.querySelectorAll("[data-planner-date]").forEach(day => {
    day.addEventListener("click", event => {
      if (event.target.closest("[data-delete-activity]")) return;
      activePlannerDate = day.dataset.plannerDate;
      activityDay.value = activePlannerDate;
      activityForm.hidden = false;
      resetActivityLookup();
      renderPlanner();
      requestAnimationFrame(() => {
        activityForm.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => activityLookup.focus({ preventScroll: true }), 350);
      });
    });
  });

  activityForm.hidden = !activePlannerDate;
  if (activePlannerDate) activityDay.value = activePlannerDate;

  plannerDays.querySelectorAll("[data-delete-activity]").forEach(button => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      trip.activities = (trip.activities || []).filter(a => a.id !== button.dataset.deleteActivity);
      resetActivityLookup();
      await saveTrips();
      renderPlanner();
      renderTrips();
    });
  });
}

function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2020, 0, 1, hours, minutes));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

document.querySelector("#signupButton").addEventListener("click", async (event) => {
  if (event.currentTarget.dataset.action === "logout") return logout();
  openAuth("signup");
});
document.querySelector("#loginButton").addEventListener("click", (event) => {
  if (event.currentTarget.dataset.action === "trips") {
    document.querySelector("#itineraries").scrollIntoView({ behavior: "smooth" });
    return;
  }
  openAuth("login");
});
document.querySelector("#heroSignupButton").addEventListener("click", async (event) => {
  if (event.currentTarget.dataset.action === "trips") {
    document.querySelector("#itineraries").scrollIntoView({ behavior: "smooth" });
    return;
  }
  if (event.currentTarget.dataset.action === "logout") return logout();
  openAuth("signup");
});
document.querySelector("#heroLoginButton").addEventListener("click", async (event) => {
  if (event.currentTarget.dataset.action === "logout") return logout();
  openAuth("login");
});
document.querySelector("#authSwitch").addEventListener("click", () => setAuthMode(authMode === "signup" ? "login" : "signup"));
document.querySelector("#newTripButton").addEventListener("click", openTripForm);
document.querySelector("#heroPlanButton").addEventListener("click", openTripForm);
document.querySelector("#closePlanner").addEventListener("click", closePlannerPage);
document.querySelector("#closeAuth").addEventListener("click", () => closeDialogSafe(authDialog));
document.querySelector("#closeTrip").addEventListener("click", () => closeDialogSafe(tripDialog));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#authName")?.value.trim() || "";
  const email = document.querySelector("#authEmail").value.trim();
  const password = document.querySelector("#authPassword").value;
  const submit = document.querySelector("#authSubmit");
  if ((authMode === "signup" && name.length < 2) || !email || password.length < 8) return;

  submit.disabled = true;
  submit.textContent = authMode === "signup" ? "Creating account..." : "Logging in...";

  try {
    const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const data = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(authMode === "signup" ? { name, email, password } : { email, password })
    });
    currentUser = data.user;
    updateAuthUI();
    await loadTripsFromServer();
    await loadFriends();
    closeDialogSafe(authDialog);
  } catch (error) {
    alert(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = authMode === "signup" ? "Create account" : "Log in";
  }
});

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = document.querySelector("#tripName").value.trim();
  const startDate = document.querySelector("#tripDate").value;
  const endDate = document.querySelector("#tripEndDate").value;
  if (!title || !startDate || !endDate || endDate < startDate) return;

  let trip;
  if (currentUser) {
    try {
      const data = await api("/api/trips", {
        method: "POST",
        body: JSON.stringify({ title, startDate, endDate })
      });
      trip = data.trip;
    } catch (error) {
      alert(error.message);
      return;
    }
  } else {
    trip = { id: crypto.randomUUID(), title, startDate, endDate, shared: 1, activities: [] };
    trips.push(trip);
    localStorage.setItem("travon.trips.v2", JSON.stringify(trips));
  }

  if (currentUser) trips.push(trip);
  renderTrips();
  closeDialogSafe(tripDialog);
  openPlanner(trip.id);
});

activityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const trip = trips.find(t => t.id === activeTripId);
  if (!trip) return;
  trip.activities ||= [];
  const type = activityType.value;
  const details = {};
  if (type === "flight") Object.assign(details,{airline:document.querySelector("#flightAirline").value.trim(),flightNumber:document.querySelector("#flightNumber").value.trim(),from:document.querySelector("#flightFrom").value.trim(),to:document.querySelector("#flightTo").value.trim(),confirmation:document.querySelector("#flightConfirmation").value.trim()});
  if (type === "airport") Object.assign(details,{name:document.querySelector("#airportName").value.trim(),code:document.querySelector("#airportCode").value.trim().toUpperCase(),terminal:document.querySelector("#airportTerminal").value.trim()});
  if (type === "hotel") Object.assign(details,{name:document.querySelector("#hotelName").value.trim(),address:document.querySelector("#hotelAddress").value.trim(),confirmation:document.querySelector("#hotelConfirmation").value.trim(),checkin:document.querySelector("#hotelCheckin").value.trim()});
  if (type === "car_rental") Object.assign(details,{company:document.querySelector("#carCompany").value.trim(),pickup:document.querySelector("#carPickup").value.trim(),dropoff:document.querySelector("#carDropoff").value.trim(),confirmation:document.querySelector("#carConfirmation").value.trim()});
  if (type === "restaurant") Object.assign(details,{name:document.querySelector("#restaurantName").value.trim(),address:document.querySelector("#restaurantAddress").value.trim(),reservation:document.querySelector("#restaurantReservation").value.trim()});
  trip.activities.push({
    id:crypto.randomUUID(),
    date:activityDay.value,
    time:document.querySelector("#activityTime").value || "12:00",
    type,
    title:document.querySelector("#activityTitle").value.trim(),
    details,
    notes:document.querySelector("#activityNotes").value.trim()
  });
  await saveTrips();
  const selectedDate = activePlannerDate;
  activityForm.reset();
  activityType.value = "activity";
  activePlannerDate = selectedDate;
  updateActivityFields();
  resetActivityLookup();
  renderPlanner();
  renderTrips();
});

activityType.addEventListener("change", () => {
  updateActivityFields();
  resetActivityLookup();
});
activityLookup.addEventListener("input", event => {
  clearTimeout(activityLookupTimer);
  activityLookupTimer = setTimeout(() => searchActivities(event.target.value), 500);
});
activityLookup.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    clearTimeout(activityLookupTimer);
    searchActivities(event.target.value);
  }
});
updateActivityFields();

if (splitzGroupForm) splitzGroupForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = splitzGroupName.value.trim();
  if (!name) return;
  const group = { id: crypto.randomUUID(), name, people: [], expenses: [] };
  splitzState.groups.push(group);
  splitzState.activeGroupId = group.id;
  splitzGroupForm.reset();
  saveSplitzState();
  renderSplitz();
});

if (splitzGroupSelect) splitzGroupSelect.addEventListener("change", event => {
  splitzState.activeGroupId = event.target.value || null;
  saveSplitzState();
  renderSplitz();
});

if (splitzPersonForm) splitzPersonForm.addEventListener("submit", event => {
  event.preventDefault();
  const group = activeSplitzGroup();
  const name = splitzPersonName.value.trim();
  if (!group || !name) return;
  if (group.people.some(person => person.name.toLowerCase() === name.toLowerCase())) {
    alert("That person is already in this group.");
    return;
  }
  group.people.push({ id: crypto.randomUUID(), name });
  splitzPersonForm.reset();
  saveSplitzState();
  renderSplitz();
});

if (splitzExpenseForm) splitzExpenseForm.addEventListener("submit", event => {
  event.preventDefault();
  const group = activeSplitzGroup();
  const title = splitzExpenseTitle.value.trim();
  const amount = Number(splitzExpenseAmount.value);
  const paidBy = splitzPaidBy.value;
  if (!group || group.people.length < 2) {
    alert("Add at least two people before adding an expense.");
    return;
  }
  if (!title || !paidBy || !Number.isFinite(amount) || amount <= 0) return;
  group.expenses.push({ id: crypto.randomUUID(), title, amount, paidBy, createdAt: Date.now() });
  splitzExpenseForm.reset();
  saveSplitzState();
  renderSplitz();
});

placeSearch.addEventListener("input", event => {
  clearTimeout(discoverTimer);
  discoverTimer = setTimeout(() => discoverPlaces(event.target.value), 800);
});
placeSearch.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    clearTimeout(discoverTimer);
    discoverPlaces(event.target.value);
  }
});
document.querySelectorAll(".bottom-nav a, .brand, .mobile-menu a, .desktop-nav a").forEach(link => {
  link.addEventListener("click", () => {
    if (document.body.classList.contains("planner-page-open")) closePlannerPage();
  });
});
document.querySelector("#menuButton").addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", () => nav.classList.remove("open"));

renderTrips();
renderPlaces();
discoverPlaces("Montreal");
loadSession();

function scrollToCurrentHashTarget() {
  const hash = window.location.hash;
  if (!hash) return;
  const target = document.querySelector(hash);
  if (!target) return;

  const scrollNow = () => {
    const headerOffset = 86;
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  };

  requestAnimationFrame(scrollNow);
  setTimeout(scrollNow, 150);
  setTimeout(scrollNow, 500);
}

window.addEventListener("hashchange", scrollToCurrentHashTarget);
window.addEventListener("pageshow", scrollToCurrentHashTarget);
window.addEventListener("load", scrollToCurrentHashTarget);
