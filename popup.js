const $ = (id) => document.getElementById(id);
const SETTINGS = { sites: {}, mode: "auto", bedtimeOn: false, bedtime: "23:00", followSystem: false };
const NAMES = { day: "Day", evening: "Evening", bedtime: "Bedtime" };
const DESCR = {
  day: "Neutral dark grey",
  evening: "Warmer and dimmer",
  bedtime: "Warmest and dimmest",
};
let host = null;
let tabId = null;

const fmt = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const timeFromHM = (hm) => { const [h, m] = hm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d; };

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
  const v = host && s.sites[host];
  const now = new Date();
  const st = FDM.compute(now, location, s);

  // Header + status
  $("toggle").checked = !!v;
  const skipped = v && v !== "force" && state === "skipped";
  const systemOff = v && s.followSystem && !matchMedia("(prefers-color-scheme: dark)").matches;
  $("forceRow").hidden = !(skipped || v === "force");
  $("force").checked = v === "force";

  const sw = $("swatch");
  sw.className = "swatch";
  if (!host) {
    $("statusTitle").textContent = "Not available here";
    $("statusSub").textContent = "Chrome doesn't let extensions change this page.";
  } else if (!v) {
    $("statusTitle").textContent = "Off on this site";
    $("statusSub").textContent = "Turn it on with the switch, Alt+Shift+D, or right-click.";
  } else if (skipped) {
    sw.classList.add("skipped");
    $("statusTitle").textContent = "Already dark";
    $("statusSub").textContent = "This site has its own dark look, so it's left alone.";
  } else if (systemOff) {
    $("statusTitle").textContent = "Waiting for dark system mode";
    $("statusSub").textContent = "Your system is in light mode right now.";
  } else {
    sw.classList.add(st.label);
    $("statusTitle").textContent = NAMES[st.label] + (st.transitioning ? ", fading in" : "");
    $("statusSub").textContent = s.mode === "auto"
      ? `${DESCR[st.label]} · ${nextChange(st.label, now, location, s)}`
      : `${DESCR[st.label]} · fixed palette`;
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
  $("sitesCount").textContent = names.length ? `Sites with dark mode (${names.length})` : "No sites yet";
  const list = $("list");
  list.innerHTML = "";
  for (const name of names) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = name;
    if (s.sites[name] === "force") {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "forced";
      span.appendChild(tag);
    }
    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.title = `Remove ${name}`;
    btn.onclick = async () => {
      delete s.sites[name];
      await chrome.storage.sync.set({ sites: s.sites });
    };
    li.append(span, btn);
    list.appendChild(li);
  }
}

async function setSite(value) {
  const { sites } = await chrome.storage.sync.get({ sites: {} });
  if (value) sites[host] = value; else delete sites[host];
  await chrome.storage.sync.set({ sites });
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab ? tab.id : null;
  try { host = new URL(tab.url).hostname || null; } catch {}
  if (host && !/^https?:/.test(tab.url)) host = null;
  $("host").textContent = host || "This page";
  $("toggle").disabled = !host;
  await render();
  requestAnimationFrame(() => document.body.classList.add("ready"));
})();

$("toggle").addEventListener("change", (e) => setSite(e.target.checked ? true : null));
$("force").addEventListener("change", (e) => setSite(e.target.checked ? "force" : true));
$("mode").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) chrome.storage.sync.set({ mode: b.dataset.mode });
});
$("bedOn").addEventListener("change", (e) => chrome.storage.sync.set({ bedtimeOn: e.target.checked }));
$("bedTime").addEventListener("change", (e) => { if (e.target.value) chrome.storage.sync.set({ bedtime: e.target.value }); });
$("followSystem").addEventListener("change", (e) => chrome.storage.sync.set({ followSystem: e.target.checked }));

// Any setting or page-state change re-renders.
chrome.storage.onChanged.addListener(() => render());

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
