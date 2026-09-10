const tripId = new URLSearchParams(location.search).get("id");
const plannerTitle = document.querySelector("#plannerTitle");
const plannerDates = document.querySelector("#plannerDates");
const plannerDays = document.querySelector("#plannerDays");
const plannerError = document.querySelector("#plannerError");
const activityForm = document.querySelector("#activityForm");
const activityType = document.querySelector("#activityType");
const activityLookup = document.querySelector("#activityLookup");
const activityLookupResults = document.querySelector("#activityLookupResults");
const selectedDayLabel = document.querySelector("#selectedDayLabel");
const shareTripButton = document.querySelector("#shareTripButton");
const shareTripForm = document.querySelector("#shareTripForm");
const shareEmail = document.querySelector("#shareEmail");
const shareMessage = document.querySelector("#shareMessage");
const shareCanEdit = document.querySelector("#shareCanEdit");
const sharedAccessList = document.querySelector("#sharedAccessList");
const editDatesButton = document.querySelector("#editDatesButton");
const editDatesForm = document.querySelector("#editDatesForm");
const editStartDate = document.querySelector("#editStartDate");
const editEndDate = document.querySelector("#editEndDate");
const editDatesMessage = document.querySelector("#editDatesMessage");
const saveDatesButton = document.querySelector("#saveDatesButton");
const activityFormTitle = activityForm?.querySelector("h2");
const activitySubmitButton = activityForm?.querySelector('button[type="submit"]');
let trip = null;
let currentUser = null;
let activeDate = null;
let lookupTimer = null;
let editingActivityId = null;
let lastTappedActivityId = null;
let lastTappedActivityAt = 0;

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

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatDate(value, options = { month:"short", day:"numeric", year:"numeric" }) {
  return new Intl.DateTimeFormat("en-US", options).format(new Date(value + "T12:00:00"));
}

function formatTime(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour:"numeric", minute:"2-digit" }).format(new Date(2020,0,1,hours,minutes));
}

function dateRange(start, end) {
  const dates = [];
  const cursor = new Date(start + "T12:00:00");
  const finish = new Date(end + "T12:00:00");
  while (cursor <= finish) {
    dates.push(cursor.toISOString().slice(0,10));
    cursor.setDate(cursor.getDate()+1);
  }
  return dates;
}

function activityTypeLabel(type) {
  return ({activity:"Activity",flight:"Flight",airport:"Airport",hotel:"Hotel",car_rental:"Car Rental",restaurant:"Restaurant",custom:"Custom"})[type] || "Activity";
}

function activityDetailsHtml(activity) {
  const d = activity.details || {};
  const rows = [];
  const add = (label, value) => { if (value) rows.push('<div><strong>'+escapeHtml(label)+':</strong> '+escapeHtml(value)+'</div>'); };
  if (activity.type === "flight") { add("Airline",d.airline); add("Flight",d.flightNumber); add("From",d.from); add("To",d.to); add("Confirmation",d.confirmation); }
  if (activity.type === "airport") { add("Airport",d.name); add("Code",d.code); add("Terminal / gate",d.terminal); }
  if (activity.type === "hotel") { add("Hotel",d.name); add("Address",d.address); add("Confirmation",d.confirmation); add("Check-in",d.checkin); }
  if (activity.type === "car_rental") { add("Rental company",d.company); add("Pickup",d.pickup); add("Drop-off",d.dropoff); add("Confirmation",d.confirmation); }
  if (activity.type === "restaurant") { add("Restaurant",d.name); add("Address",d.address); add("Reservation",d.reservation); }
  add("Notes",activity.notes);
  return rows.length ? '<div class="activity-details">'+rows.join("")+'</div>' : "";
}

async function loadTrip() {
  if (!tripId) return showError("This itinerary link is missing a trip ID.");
  try {
    const me = await api("/api/auth/me");
    currentUser = me.user || null;
  } catch {}
  if (currentUser) {
    const data = await api("/api/trips");
    trip = (data.trips || []).find(item => String(item.id) === String(tripId));
  } else {
    const trips = JSON.parse(localStorage.getItem("travon.trips.v2") || "[]");
    trip = trips.find(item => String(item.id) === String(tripId));
  }
  if (!trip) return showError("We couldn't find this itinerary.");
  const readOnly = trip.access === "shared";
  document.body.classList.toggle("read-only-trip", readOnly);
  editDatesButton.hidden = readOnly;
  if (readOnly) editDatesForm.hidden = true;
  shareTripButton.hidden = trip.access !== "owner";
  if (trip.access !== "owner") shareTripForm.hidden = true;
  if (readOnly) activityForm.hidden = true;
  if (trip.access === "owner") await loadShareAccess();
  renderPlanner();
}

async function loadShareAccess() {
  if (!sharedAccessList || trip?.access !== "owner" || !currentUser) return;
  try {
    const data = await api("/api/shares");
    const shares = (data.shares || []).filter(item => item.direction === "outgoing" && String(item.tripId) === String(trip.id));
    sharedAccessList.hidden = !shares.length;
    sharedAccessList.innerHTML = shares.length ? '<div class="shared-access-heading"><strong>People with access</strong><small>Only you can change permissions.</small></div>' + shares.map(item =>
      '<div class="shared-access-row"><div><strong>' + escapeHtml(item.name || item.email) + '</strong><small>' + escapeHtml(item.email) + '</small></div><select data-share-access="' + item.id + '"><option value="view"' + (!item.canEdit ? ' selected' : '') + '>View only</option><option value="edit"' + (item.canEdit ? ' selected' : '') + '>Can edit</option></select></div>'
    ).join("") : "";
    sharedAccessList.querySelectorAll("[data-share-access]").forEach(select => select.addEventListener("change", async () => {
      const canEdit = select.value === "edit";
      select.disabled = true;
      try {
        await api("/api/shares", { method:"PUT", body:JSON.stringify({ shareId:select.dataset.shareAccess, canEdit }) });
      } catch (error) {
        alert(error.message);
        await loadShareAccess();
      } finally {
        select.disabled = false;
      }
    }));
  } catch {
    sharedAccessList.hidden = true;
  }
}

function showError(message) {
  plannerError.hidden = false;
  plannerError.innerHTML = '<h3>Itinerary unavailable</h3><p>'+escapeHtml(message)+'</p>';
  plannerDays.innerHTML = "";
  activityForm.hidden = true;
}

function openActivityEditor(activity) {
  if (!activity || !trip || trip.access === "shared") return;
  editingActivityId = activity.id;
  activeDate = activity.date;
  activityForm.hidden = false;
  activityForm.reset();
  selectedDayLabel.textContent = formatDate(activity.date,{weekday:"long",month:"long",day:"numeric"});
  activityType.value = activity.type || "activity";
  updateFields();
  resetLookup();

  document.querySelector("#activityTime").value = activity.time || "12:00";
  document.querySelector("#activityTitle").value = activity.title || "";
  document.querySelector("#activityNotes").value = activity.notes || "";
  const d = activity.details || {};

  if (activity.type === "flight") {
    document.querySelector("#flightAirline").value = d.airline || "";
    document.querySelector("#flightNumber").value = d.flightNumber || "";
    document.querySelector("#flightFrom").value = d.from || "";
    document.querySelector("#flightTo").value = d.to || "";
    document.querySelector("#flightConfirmation").value = d.confirmation || "";
  }
  if (activity.type === "airport") {
    document.querySelector("#airportName").value = d.name || "";
    document.querySelector("#airportCode").value = d.code || "";
    document.querySelector("#airportTerminal").value = d.terminal || "";
  }
  if (activity.type === "hotel") {
    document.querySelector("#hotelName").value = d.name || "";
    document.querySelector("#hotelAddress").value = d.address || "";
    document.querySelector("#hotelConfirmation").value = d.confirmation || "";
    document.querySelector("#hotelCheckin").value = d.checkin || "";
  }
  if (activity.type === "car_rental") {
    document.querySelector("#carCompany").value = d.company || "";
    document.querySelector("#carPickup").value = d.pickup || "";
    document.querySelector("#carDropoff").value = d.dropoff || "";
    document.querySelector("#carConfirmation").value = d.confirmation || "";
  }
  if (activity.type === "restaurant") {
    document.querySelector("#restaurantName").value = d.name || "";
    document.querySelector("#restaurantAddress").value = d.address || "";
    document.querySelector("#restaurantReservation").value = d.reservation || "";
  }

  if (activityFormTitle) activityFormTitle.textContent = "Edit activity";
  if (activitySubmitButton) activitySubmitButton.textContent = "Save changes";
  renderPlanner();
  requestAnimationFrame(() => activityForm.scrollIntoView({behavior:"smooth",block:"start"}));
}

function renderPlanner() {
  plannerTitle.textContent = trip.title;
  plannerDates.textContent = formatDate(trip.startDate) + " – " + formatDate(trip.endDate);
  const ownerNote = document.querySelector("#sharedOwnerNote");
  if (ownerNote) {
    ownerNote.hidden = trip.access === "owner";
    ownerNote.textContent = trip.access === "editor"
      ? "Shared with you by " + (trip.ownerName || "TravOn user") + " · You can edit"
      : trip.access === "shared" ? "Shared with you by " + (trip.ownerName || "TravOn user") + " · View only" : "";
  }
  plannerDays.innerHTML = "";

  dateRange(trip.startDate, trip.endDate).forEach((date,index) => {
    const activities = (trip.activities || []).filter(a => a.date === date).sort((a,b) => (a.time||"").localeCompare(b.time||""));
    const day = document.createElement("section");
    day.className = "planner-day" + (activeDate === date ? " active" : "");
    day.dataset.date = date;
    day.innerHTML = `
      <div class="planner-day-heading">
        <div>
          <span class="day-number">Day ${index+1}</span>
          <h3>${formatDate(date,{weekday:"long",month:"long",day:"numeric"})}</h3>
        </div>
        <span class="day-add-hint">${trip.access === "shared" ? "View only" : (activeDate === date && !editingActivityId ? "Adding here" : "Tap to add +")}</span>
      </div>
      <div class="activity-list">
        ${activities.length ? activities.map(activity => `
          <div class="activity${String(editingActivityId) === String(activity.id) ? " editing" : ""}" data-activity-id="${activity.id}" title="Double tap to edit">
            <span class="activity-time">${formatTime(activity.time)}</span>
            <span class="activity-main">
              <span class="activity-kind">${activityTypeLabel(activity.type)}</span>
              <strong>${escapeHtml(activity.title)}</strong>
              ${activityDetailsHtml(activity)}
            </span>
            ${trip.access === "shared" ? "" : `<button type="button" data-delete="${activity.id}" aria-label="Delete activity">×</button>`}
          </div>`).join("") : '<span class="day-empty">No activities yet. Tap this day to add one.</span>'}
      </div>`;

    day.addEventListener("click", event => {
      if (trip.access === "shared") return;
      if (event.target.closest("[data-delete], [data-activity-id]")) return;
      editingActivityId = null;
      activeDate = date;
      activityForm.hidden = false;
      selectedDayLabel.textContent = formatDate(date,{weekday:"long",month:"long",day:"numeric"});
      resetFormForDate();
      renderPlanner();
      requestAnimationFrame(() => activityForm.scrollIntoView({behavior:"smooth",block:"start"}));
    });

    day.querySelectorAll("[data-activity-id]").forEach(card => {
      const editThisActivity = event => {
        if (trip.access === "shared" || event.target.closest("[data-delete]")) return;
        event.preventDefault();
        event.stopPropagation();
        const activity = (trip.activities || []).find(a => String(a.id) === String(card.dataset.activityId));
        openActivityEditor(activity);
      };

      card.addEventListener("dblclick", editThisActivity);
      card.addEventListener("touchend", event => {
        if (event.target.closest("[data-delete]")) return;
        const now = Date.now();
        const id = card.dataset.activityId;
        if (lastTappedActivityId === id && now - lastTappedActivityAt < 420) {
          lastTappedActivityAt = 0;
          lastTappedActivityId = null;
          editThisActivity(event);
          return;
        }
        lastTappedActivityId = id;
        lastTappedActivityAt = now;
      }, {passive:false});
    });

    day.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", async event => {
      event.stopPropagation();
      const deletingId = button.dataset.delete;
      trip.activities = (trip.activities || []).filter(a => String(a.id) !== String(deletingId));
      if (String(editingActivityId) === String(deletingId)) {
        editingActivityId = null;
        activityForm.hidden = true;
      }
      await saveTrip();
      renderPlanner();
    }));
    plannerDays.appendChild(day);
  });
}

function resetLookup() {
  clearTimeout(lookupTimer);
  activityLookup.value = "";
  activityLookupResults.innerHTML = "";
  activityLookupResults.hidden = true;
}

function resetFormForDate() {
  const date = activeDate;
  editingActivityId = null;
  activityForm.reset();
  activeDate = date;
  activityType.value = "activity";
  selectedDayLabel.textContent = formatDate(activeDate,{weekday:"long",month:"long",day:"numeric"});
  if (activityFormTitle) activityFormTitle.textContent = "Add to itinerary";
  if (activitySubmitButton) activitySubmitButton.textContent = "Add to itinerary";
  updateFields();
  resetLookup();
}

function updateFields() {
  ["flightFields","airportFields","hotelFields","carFields","restaurantFields"].forEach(id => document.querySelector("#"+id).hidden = true);
  const map = {flight:"flightFields",airport:"airportFields",hotel:"hotelFields",car_rental:"carFields",restaurant:"restaurantFields"};
  if (map[activityType.value]) document.querySelector("#"+map[activityType.value]).hidden = false;
}

async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 2) return resetLookup();
  activityLookupResults.hidden = false;
  activityLookupResults.innerHTML = '<div class="lookup-status">Searching…</div>';
  try {
    const data = await api("/api/activity-search?q="+encodeURIComponent(q)+"&type="+encodeURIComponent(activityType.value), {method:"GET",headers:{}});
    const results = Array.isArray(data.results) ? data.results : [];
    activityLookupResults.innerHTML = results.length ? results.map((result,index) => `
      <button type="button" class="lookup-result" data-index="${index}">
        <span class="lookup-placeholder">⌖</span>
        <span><strong>${escapeHtml(result.title)}</strong><small>${escapeHtml(result.address || result.description || "")}</small></span>
      </button>`).join("") : '<div class="lookup-status">No matches found. You can still enter it manually.</div>';
    activityLookupResults.querySelectorAll("[data-index]").forEach(button => {
      const selectResult = event => {
        event.preventDefault();
        event.stopPropagation();
        const result = results[Number(button.dataset.index)];
        const selectedType = activityType.value;
        document.querySelector("#activityTitle").value = result.title || "";
        if (selectedType === "hotel") {
          document.querySelector("#hotelName").value = result.title || "";
          document.querySelector("#hotelAddress").value = result.address || result.description || "";
        } else if (selectedType === "airport") {
          document.querySelector("#airportName").value = result.title || "";
        } else if (selectedType === "restaurant") {
          document.querySelector("#restaurantName").value = result.title || "";
          document.querySelector("#restaurantAddress").value = result.address || result.description || "";
        } else if (selectedType === "car_rental") {
          document.querySelector("#carPickup").value = result.address || result.description || "";
        }
        activityType.value = selectedType;
        updateFields();
        resetLookup();
        activityLookup.blur();
        const target = selectedType === "hotel" ? document.querySelector("#hotelFields") : document.querySelector("#activityTitle");
        requestAnimationFrame(() => target?.scrollIntoView({behavior:"smooth",block:"center"}));
      };
      button.addEventListener("click", selectResult);
    });
  } catch (error) {
    activityLookupResults.innerHTML = '<div class="lookup-status">'+escapeHtml(error.message)+' You can still enter it manually.</div>';
  }
}

async function saveTrip() {
  if (trip?.access === "shared") return;
  if (currentUser) {
    await api("/api/trips",{method:"PUT",body:JSON.stringify({id:trip.id,activities:trip.activities || []})});
  } else {
    const trips = JSON.parse(localStorage.getItem("travon.trips.v2") || "[]");
    const index = trips.findIndex(item => String(item.id) === String(trip.id));
    if (index >= 0) trips[index] = trip;
    localStorage.setItem("travon.trips.v2",JSON.stringify(trips));
  }
}

function openDateEditor() {
  if (!trip || trip.access === "shared") return;
  editStartDate.value = trip.startDate;
  editEndDate.value = trip.endDate;
  editDatesMessage.textContent = "";
  editDatesButton.hidden = true;
  editDatesForm.hidden = false;
  requestAnimationFrame(() => editStartDate.focus());
}

function closeDateEditor() {
  editDatesForm.hidden = true;
  editDatesButton.hidden = trip?.access === "shared";
  editDatesMessage.textContent = "";
}

editDatesButton?.addEventListener("click", openDateEditor);
document.querySelector("#cancelEditDates")?.addEventListener("click", closeDateEditor);
editDatesForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!trip || trip.access === "shared") return;
  const startDate = editStartDate.value;
  const endDate = editEndDate.value;
  if (!startDate || !endDate || endDate < startDate) {
    editDatesMessage.textContent = "Choose a valid start and end date.";
    return;
  }
  if (startDate === trip.startDate && endDate === trip.endDate) {
    closeDateEditor();
    return;
  }
  const activities = trip.activities || [];
  const removedActivities = activities.filter(activity => activity.date < startDate || activity.date > endDate);
  if (removedActivities.length) {
    const confirmed = window.confirm(`This date change removes ${removedActivities.length} scheduled ${removedActivities.length === 1 ? "activity" : "activities"}. Continue?`);
    if (!confirmed) return;
  }
  const keptActivities = activities.filter(activity => activity.date >= startDate && activity.date <= endDate);
  saveDatesButton.disabled = true;
  editDatesMessage.textContent = "Saving…";
  try {
    if (currentUser) {
      await api("/api/trips", { method:"PUT", body:JSON.stringify({ id:trip.id, startDate, endDate, activities:keptActivities }) });
    } else {
      const trips = JSON.parse(localStorage.getItem("travon.trips.v2") || "[]");
      const index = trips.findIndex(item => String(item.id) === String(trip.id));
      if (index >= 0) trips[index] = { ...trips[index], startDate, endDate, activities:keptActivities };
      localStorage.setItem("travon.trips.v2", JSON.stringify(trips));
    }
    trip.startDate = startDate;
    trip.endDate = endDate;
    trip.activities = keptActivities;
    if (activeDate && (activeDate < startDate || activeDate > endDate)) {
      activeDate = null;
      editingActivityId = null;
      activityForm.hidden = true;
    }
    closeDateEditor();
    renderPlanner();
  } catch (error) {
    editDatesMessage.textContent = error.message;
  } finally {
    saveDatesButton.disabled = false;
  }
});

activityType.addEventListener("change",() => { updateFields(); resetLookup(); });
activityLookup.addEventListener("input",event => {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(() => searchPlaces(event.target.value),500);
});
activityLookup.addEventListener("keydown",event => {
  if (event.key === "Enter") {
    event.preventDefault();
    clearTimeout(lookupTimer);
    searchPlaces(event.target.value);
  }
});

activityForm.addEventListener("submit",async event => {
  event.preventDefault();
  if (!activeDate || !trip || trip.access === "shared") return;
  const type = activityType.value;
  const details = {};
  if (type === "flight") Object.assign(details,{airline:document.querySelector("#flightAirline").value.trim(),flightNumber:document.querySelector("#flightNumber").value.trim(),from:document.querySelector("#flightFrom").value.trim(),to:document.querySelector("#flightTo").value.trim(),confirmation:document.querySelector("#flightConfirmation").value.trim()});
  if (type === "airport") Object.assign(details,{name:document.querySelector("#airportName").value.trim(),code:document.querySelector("#airportCode").value.trim().toUpperCase(),terminal:document.querySelector("#airportTerminal").value.trim()});
  if (type === "hotel") Object.assign(details,{name:document.querySelector("#hotelName").value.trim(),address:document.querySelector("#hotelAddress").value.trim(),confirmation:document.querySelector("#hotelConfirmation").value.trim(),checkin:document.querySelector("#hotelCheckin").value.trim()});
  if (type === "car_rental") Object.assign(details,{company:document.querySelector("#carCompany").value.trim(),pickup:document.querySelector("#carPickup").value.trim(),dropoff:document.querySelector("#carDropoff").value.trim(),confirmation:document.querySelector("#carConfirmation").value.trim()});
  if (type === "restaurant") Object.assign(details,{name:document.querySelector("#restaurantName").value.trim(),address:document.querySelector("#restaurantAddress").value.trim(),reservation:document.querySelector("#restaurantReservation").value.trim()});

  const updatedActivity = {
    date:activeDate,
    time:document.querySelector("#activityTime").value || "12:00",
    type,
    title:document.querySelector("#activityTitle").value.trim(),
    details,
    notes:document.querySelector("#activityNotes").value.trim()
  };

  trip.activities ||= [];
  if (editingActivityId) {
    const index = trip.activities.findIndex(a => String(a.id) === String(editingActivityId));
    if (index >= 0) trip.activities[index] = { ...trip.activities[index], ...updatedActivity };
  } else {
    trip.activities.push({ id:crypto.randomUUID(), ...updatedActivity });
  }

  await saveTrip();
  resetFormForDate();
  renderPlanner();
});

updateFields();
loadTrip();
shareTripButton?.addEventListener("click", () => {
  if (trip?.access !== "owner") return;
  if (!currentUser) {
    alert("Log in to share an itinerary.");
    return;
  }
  shareTripButton.hidden = true;
  shareTripForm.hidden = false;
  shareMessage.textContent = "";
  requestAnimationFrame(() => shareEmail.focus());
});
document.querySelector("#cancelShare")?.addEventListener("click", () => {
  shareTripForm.hidden = true;
  shareTripButton.hidden = false;
  shareTripForm.reset();
  shareMessage.textContent = "";
});
shareTripForm?.addEventListener("submit", async event => {
  event.preventDefault();
  shareMessage.textContent = "Sharing…";
  try {
    const data = await api("/api/shares", {
      method:"POST",
      body:JSON.stringify({ tripId: trip.id, email: shareEmail.value.trim(), canEdit: shareCanEdit?.value === "edit" })
    });
    shareMessage.textContent = "Shared with " + (data.share.name || "TravOn user") + ".";
    shareEmail.value = "";
    if (shareCanEdit) shareCanEdit.value = "view";
    await loadShareAccess();
  } catch (error) {
    shareMessage.textContent = error.message;
  }
});