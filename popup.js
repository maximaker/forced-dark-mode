const $ = (id) => document.getElementById(id);
const SETTINGS = { sites: {}, mode: "auto", bedtimeOn: false, bedtime: "23:00", followSystem: false };
const NAMES = { day: "Day", evening: "Evening", bedtime: "Bedtime" };
const DESCR = { day: "Neutral dark grey", evening: "Warmer and dimmer", bedtime: "Warmest and dimmest" };
const originFor = (h) => `*://${h}/*`;
let host = null;
let tabId = null;

const fmt = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const timeFromHM = (hm) => { const [h, m] = hm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d; };

// Hosts Chrome currently lets us run on.
async function grantedHosts() {
  const { origins = [] } = await chrome.permissions.getAll();
  return new Set(origins.map((o) => (o.match(/^\*:\/\/([^/]+)\/\*$/) || [])[1]).filter(Boolean));
}

// What changes next, in Auto mode.
function nextChange(label, now, loc, s) {
  const t = FDM.times(now, loc);
  if (label === "day") return `Evening from ${fmt(t.sunset)}`;
  if (label === "evening" && s.bedtimeOn) return `Bedtime from ${fmt(timeFromHM(s.bedtime))}`;
  const sunrise = now < t.sunrise ? t.sunrise : FDM.times(new Date(+now + 864e5), loc).sunrise;
  return `Day from ${fmt(sunrise)}`;
}

async function render() {
  const s = await chrome.storage.sync.get(SETTINGS);
  const { location } = await chrome.storage.local.get({ location: null });
  const state = tabId != null ? (await chrome.storage.session.get("tab" + tabId))["tab" + tabId] : null;
  const granted = await grantedHosts();
  const v = host && s.sites[host];
  const needsAccess = v && !granted.has(host);
  const now = new Date();
  const st = FDM.compute(now, location, s);

  // Header + status
  $("toggle").checked = !!v;
  const skipped = v && !needsAccess && v !== "force" && state === "skipped";
  const systemOff = v && s.followSystem && !matchMedia("(prefers-color-scheme: dark)").matches;
  $("forceRow").hidden = !(skipped || v === "force");
  $("force").checked = v === "force";
  $("allow").hidden = !needsAccess;

  const sw = $("swatch");
  sw.className = "swatch";
  const set = (title, sub) => { $("statusTitle").textContent = title; $("statusSub").textContent = sub; };
  if (!host) {
    set("Not available here", "Chrome doesn't let extensions change this page.");
  } else if (!v) {
    set("Off on this site", "Turn it on with the switch, Alt+Shift+D, or right-click.");
  } else if (needsAccess) {
    sw.classList.add("needs");
    set("Needs your OK", "Chrome asks once per site before dark mode can change it.");
  } else if (skipped) {
    sw.classList.add("skipped");
    set("Already dark", "This site has its own dark look, so it's left alone.");
  } else if (systemOff) {
    set("Waiting for dark system mode", "Your system is in light mode right now.");
  } else {
    sw.classList.add(st.label);
    set(NAMES[st.label] + (st.transitioning ? ", fading in" : ""),
      s.mode === "auto" ? `${DESCR[st.label]} · ${nextChange(st.label, now, location, s)}` : `${DESCR[st.label]} · fixed palette`);
  }

  // Palette
  for (const b of $("mode").querySelectorAll("button")) {
    const on = b.dataset.mode === s.mode;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on);
  }
  const t = FDM.times(now, location);
  $("schedule").textContent = s.mode === "auto"
    ? `Follows the sun: sunrise ${fmt(t.sunrise)}, sunset ${fmt(t.sunset)}, with gentle fades.`
    : `Always ${NAMES[s.mode]}. Pick Auto to follow the sun.`;

  // Options
  $("bedOn").checked = s.bedtimeOn;
  $("bedTime").value = s.bedtime;
  $("bedTime").disabled = !s.bedtimeOn;
  $("followSystem").checked = s.followSystem;
  $("locText").textContent = location ? "Sunset times: your location" : "Sunset times: defaults";
  $("locate").textContent = location ? "Update" : "Use my location";

  // Sites
  const names = Object.keys(s.sites).sort();
  const missing = names.filter((n) => !granted.has(n));
  // The current site has its own Allow button; this one covers the rest (e.g. after updating to 1.3).
  const others = missing.filter((n) => n !== host);
  $("allowAll").hidden = others.length === 0;
  $("allowAll").textContent = `Allow access on ${missing.length} saved site${missing.length === 1 ? "" : "s"}`;
  $("sitesCount").textContent = names.length ? `Sites with dark mode (${names.length})` : "No sites yet";
  const list = $("list");
  list.innerHTML = "";
  for (const name of names) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = name;
    const tagText = !granted.has(name) ? "needs access" : s.sites[name] === "force" ? "forced" : "";
    if (tagText) {
      const tag = document.createElement("span");
      tag.className = "tag" + (!granted.has(name) ? " warn" : "");
      tag.textContent = tagText;
      span.appendChild(tag);
    }
    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.title = `Remove ${name}`;
    btn.onclick = () => removeSite(name);
    li.append(span, btn);
    list.appendChild(li);
  }
}

// Ask Chrome for access (must run straight from a click), then start on this tab.
async function requestAccess(hosts) {
  let ok = false;
  try { ok = await chrome.permissions.request({ origins: hosts.map(originFor) }); } catch {}
  if (ok && tabId != null && hosts.includes(host)) chrome.runtime.sendMessage({ type: "inject", tabId });
  return ok;
}

async function removeSite(name) {
  const { sites } = await chrome.storage.sync.get({ sites: {} });
  delete sites[name];
  await chrome.storage.sync.set({ sites });
  try { await chrome.permissions.remove({ origins: [originFor(name)] }); } catch {}
  render();
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab ? tab.id : null;
  try { if (/^https?:/.test(tab.url)) host = new URL(tab.url).hostname || null; } catch {}
  $("host").textContent = host || "This page";
  $("toggle").disabled = !host;
  await render();
  requestAnimationFrame(() => document.body.classList.add("ready"));
})();

$("toggle").addEventListener("change", async (e) => {
  if (!e.target.checked) return removeSite(host);
  // Ask first, while the click still counts as a user gesture.
  const ok = await requestAccess([host]);
  if (!ok) { e.target.checked = false; return; }
  const { sites } = await chrome.storage.sync.get({ sites: {} });
  sites[host] = true;
  await chrome.storage.sync.set({ sites });
});
$("allow").addEventListener("click", async () => { if (await requestAccess([host])) render(); });
$("allowAll").addEventListener("click", async () => {
  const { sites } = await chrome.storage.sync.get({ sites: {} });
  const granted = await grantedHosts();
  const missing = Object.keys(sites).filter((n) => !granted.has(n));
  if (missing.length && await requestAccess(missing)) render();
});
$("force").addEventListener("change", async (e) => {
  const { sites } = await chrome.storage.sync.get({ sites: {} });
  sites[host] = e.target.checked ? "force" : true;
  await chrome.storage.sync.set({ sites });
});
$("mode").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) chrome.storage.sync.set({ mode: b.dataset.mode });
});
$("bedOn").addEventListener("change", (e) => chrome.storage.sync.set({ bedtimeOn: e.target.checked }));
$("bedTime").addEventListener("change", (e) => { if (e.target.value) chrome.storage.sync.set({ bedtime: e.target.value }); });
$("followSystem").addEventListener("change", (e) => chrome.storage.sync.set({ followSystem: e.target.checked }));

// Any setting or page-state change re-renders; so does a permission change.
chrome.storage.onChanged.addListener(() => render());
chrome.permissions.onAdded.addListener(() => render());
chrome.permissions.onRemoved.addListener(() => render());

$("locate").addEventListener("click", () => {
  $("locate").textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      // Rounded to ~1 km: plenty for sunset times. Stored only on this device.
      await chrome.storage.local.set({
        location: {
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
        },
      });
    },
    () => { $("locate").textContent = "Try again"; },
    { timeout: 15000, maximumAge: 86400000 }
  );
});
