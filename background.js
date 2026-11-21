// Shortcut, right-click menu, and the toolbar badge.

async function toggleTab(tab) {
  if (!tab || !tab.url) return;
  let host;
  try { host = new URL(tab.url).hostname; } catch { return; }
  if (!host) return;
  const { sites } = await chrome.storage.sync.get({ sites: {} });
  if (sites[host]) delete sites[host]; else sites[host] = true;
  await chrome.storage.sync.set({ sites });
}

// Keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-dark") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggleTab(tab);
});

// Right-click menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fdm-toggle",
    title: "Dark mode on this site (on/off)",
    contexts: ["page", "frame", "selection", "link", "image"],
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "fdm-toggle") toggleTab(tab);
});

// Badge: a small coloured pill showing what the page is using right now.
const BADGE = {
  day:     { color: "#dfe5f2" },
  evening: { color: "#f0aa5a" },
  bedtime: { color: "#c4622d" },
  skipped: { color: "#6b6b75" },
};

function setBadge(tabId, state) {
  const b = BADGE[state];
  if (!b) {
    chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }
  chrome.action.setBadgeText({ tabId, text: "•" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ tabId, color: b.color });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "state" && sender.tab && sender.frameId === 0) {
    setBadge(sender.tab.id, msg.state);
    chrome.storage.session.set({ ["tab" + sender.tab.id]: msg.state });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove("tab" + tabId));
