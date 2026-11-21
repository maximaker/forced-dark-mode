// Per-site access: the content script is registered only for sites the user granted.
// Also: shortcut, right-click menu, and the toolbar badge.

const SCRIPT_ID = "fdm";
const originFor = (host) => `*://${host}/*`;

function hostOf(tab) {
  try {
    const u = new URL(tab.url);
    return /^https?:$/.test(u.protocol) ? u.hostname : null;
  } catch { return null; }
}

// Keep the registered content script in step with the granted sites.
async function syncScripts() {
  const { origins = [] } = await chrome.permissions.getAll();
  const matches = origins.filter((o) => o !== "*://*/*" && o !== "<all_urls>");
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (!matches.length) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return;
  }
  const def = {
    id: SCRIPT_ID, js: ["sun.js", "content.js"], matches,
    runAt: "document_start", allFrames: true, persistAcrossSessions: true,
  };
  if (existing.length) await chrome.scripting.updateContentScripts([def]);
  else await chrome.scripting.registerContentScripts([def]);
}

// Start the script on an already-open tab (it guards against loading twice).
async function injectNow(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["sun.js", "content.js"] });
  } catch {}
}

async function toggleTab(tab) {
  const host = tab && hostOf(tab);
  if (!host) return;
  const { sites } = await chrome.storage.sync.get({ sites: {} });
  if (sites[host]) {
    delete sites[host];
    await chrome.storage.sync.set({ sites });
    return;
  }
  const origins = [originFor(host)];
  let granted = await chrome.permissions.contains({ origins });
  if (!granted) {
    try { granted = await chrome.permissions.request({ origins }); } catch { granted = false; }
  }
  if (!granted) {
    // Chrome didn't let us ask from here: open the popup, where one click asks.
    sites[host] = true;
    await chrome.storage.sync.set({ sites });
    try { await chrome.action.openPopup(); } catch {}
    return;
  }
  sites[host] = true;
  await chrome.storage.sync.set({ sites });
  await syncScripts();
  injectNow(tab.id);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fdm-toggle",
    title: "Dark mode on this site (on/off)",
    contexts: ["page", "frame", "selection", "link", "image"],
  });
  syncScripts();
});
chrome.runtime.onStartup.addListener(syncScripts);
chrome.permissions.onAdded.addListener(syncScripts);
chrome.permissions.onRemoved.addListener(syncScripts);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-dark") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggleTab(tab);
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "fdm-toggle") toggleTab(tab);
});

// Popup asks us to start the script on a tab after a grant.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "inject" && msg.tabId != null) {
    syncScripts().then(() => injectNow(msg.tabId));
    return;
  }
  if (msg && msg.type === "state" && sender.tab && sender.frameId === 0) {
    setBadge(sender.tab.id, msg.state);
    chrome.storage.session.set({ ["tab" + sender.tab.id]: msg.state });
  }
});

// Badge: a small coloured pill showing what the page is using right now.
const BADGE = { day: "#dfe5f2", evening: "#f0aa5a", bedtime: "#c4622d", skipped: "#6b6b75" };

function setBadge(tabId, state) {
  const color = BADGE[state];
  if (!color) {
    chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }
  chrome.action.setBadgeText({ tabId, text: "•" });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ tabId, color });
}

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove("tab" + tabId));
