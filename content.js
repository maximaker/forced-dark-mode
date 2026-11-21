// Runs at document_start in every frame. Applies the dark palette to enabled sites,
// skips sites that are already dark, and flips CSS background images back.
(() => {
  // Can be both registered and injected into an open tab: only run once per frame.
  if (window.__fdmLoaded) return;
  window.__fdmLoaded = true;

  const STYLE_ID = "forced-dark-mode-style";
  const host = location.hostname;
  const isTop = window === window.top;
  const systemDark = matchMedia("(prefers-color-scheme: dark)");

  let timer = null;
  let applied = false;     // style currently on the page
  let detected = null;     // null = not checked yet on this page, else true/false (page is dark)
  let lastState = null;

  const SETTINGS = { sites: {}, mode: "auto", bedtimeOn: false, bedtime: "23:00", followSystem: false };

  // ---- Styles ----
  const css = (filter, smooth) => `
    html {
      filter: ${filter} !important;
      background-color: #fff !important;
      ${smooth ? "transition: filter 2s linear !important;" : ""}
    }
    /* Flip media back so photos and videos look normal */
    img, video, picture, canvas, iframe, svg image,
    [style*="background-image"], [data-fdm-bg], embed, object {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    /* Don't double-flip media nested inside already-flipped elements */
    [style*="background-image"] img, [data-fdm-bg] img, [data-fdm-bg] video, picture img {
      filter: none !important;
    }
  `;

  function setStyle(text) {
    let el = document.getElementById(STYLE_ID);
    if (text === null) { el && el.remove(); return; }
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    if (el.textContent !== text) el.textContent = text;
  }

  function activate(filter) {
    // No transition the first time, so the page doesn't fade in from light.
    setStyle(css(filter, applied));
    applied = true;
    startBgScan();
  }

  function deactivate() {
    setStyle(null);
    applied = false;
    stopBgScan();
  }

  function report(state) {
    if (!isTop || state === lastState) return;
    lastState = state;
    try { chrome.runtime.sendMessage({ type: "state", state }); } catch {}
  }

  // ---- Already-dark detection ----
  function parseColor(c) {
    const m = c && c.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    const [r, g, b, a = 1] = m.map(Number);
    return { r, g, b, a };
  }

  // Reads the page's own background (with our style switched off) at the centre and top of the screen.
  function pageIsDark() {
    const el = document.getElementById(STYLE_ID);
    if (el && el.sheet) el.sheet.disabled = true;
    try {
      const points = [[innerWidth / 2, innerHeight / 2], [innerWidth / 2, 10]];
      let votes = 0, total = 0;
      for (const [x, y] of points) {
        const stack = document.elementsFromPoint(x, y).concat([document.body, document.documentElement]);
        for (const node of stack) {
          if (!node) continue;
          const c = parseColor(getComputedStyle(node).backgroundColor);
          if (!c || c.a < 0.5) continue;
          const lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
          total++;
          if (lum < 0.4) votes++;
          break;
        }
      }
      return total > 0 && votes === total;
    } finally {
      if (el && el.sheet) el.sheet.disabled = false;
    }
  }

  function detect() {
    if (!document.body) return;
    // Only check while the site is enabled; skip if forced.
    chrome.storage.sync.get(SETTINGS, (s) => {
      const v = s.sites[host];
      if (!v || v === "force") return;
      const dark = pageIsDark();
      if (dark === detected) return;
      detected = dark;
      if (isTop) {
        // Remember per host so the next visit skips straight away (no flash).
        chrome.storage.local.get({ darkHosts: {} }, ({ darkHosts }) => {
          if (!!darkHosts[host] === dark) return update();
          if (dark) darkHosts[host] = true; else delete darkHosts[host];
          chrome.storage.local.set({ darkHosts });
        });
      } else {
        update();
      }
    });
  }

  // ---- Main decision ----
  function update() {
    clearTimeout(timer);
    chrome.storage.sync.get(SETTINGS, (s) => {
      chrome.storage.local.get({ location: null, darkHosts: {} }, (l) => {
        const v = s.sites[host];
        if (!v || (s.followSystem && !systemDark.matches)) {
          deactivate();
          report("off");
          return;
        }
        const isDark = detected !== null ? detected : !!l.darkHosts[host];
        if (v !== "force" && isDark) {
          deactivate();
          report("skipped");
          return;
        }
        const st = FDM.compute(new Date(), l.location, s);
        activate(st.filter);
        report(st.label);
        // Step every minute during a fade, otherwise check every 5 minutes.
        timer = setTimeout(update, st.transitioning ? 60 * 1000 : 5 * 60 * 1000);
      });
    });
  }

  // ---- CSS background images (set in stylesheets, not inline) ----
  let observer = null;
  let pending = new Set();
  let flushQueued = false;

  function mark(el) {
    if (el.nodeType !== 1 || el === document.body || el === document.documentElement) return;
    if (el.hasAttribute("data-fdm-bg")) return;
    const bi = getComputedStyle(el).backgroundImage;
    if (!bi || bi.indexOf("url(") === -1) return;
    if (el.closest('img, picture, video, svg, [style*="background-image"]')) return;
    if (el.parentElement && el.parentElement.closest("[data-fdm-bg]")) return;
    // Elements with text over the image stay as they are, or the text would turn light-on-light.
    if (el.textContent.trim()) return;
    el.setAttribute("data-fdm-bg", "");
  }

  function scan(root, deep) {
    if (!root || root.nodeType !== 1) return;
    mark(root);
    if (!deep) return;
    const all = root.getElementsByTagName("*");
    for (let i = 0; i < all.length && i < 4000; i++) mark(all[i]);
  }

  function flush() {
    flushQueued = false;
    if (!applied) { pending.clear(); return; }
    const items = pending;
    pending = new Set();
    for (const [node, deep] of items) scan(node, deep);
  }

  function queue(node, deep) {
    pending.add([node, deep]);
    if (flushQueued) return;
    flushQueued = true;
    (window.requestIdleCallback || setTimeout)(flush, { timeout: 1000 });
  }

  function startBgScan() {
    if (observer) return;
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "childList") m.addedNodes.forEach((n) => n.nodeType === 1 && queue(n, true));
        else queue(m.target, false);
      }
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"],
    });
    if (document.body) queue(document.body, true);
  }

  function stopBgScan() {
    if (observer) observer.disconnect();
    observer = null;
    pending.clear();
  }

  // ---- Wiring ----
  update();
  chrome.storage.onChanged.addListener(update);
  systemDark.addEventListener("change", update);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) update(); });
  document.addEventListener("DOMContentLoaded", () => { detect(); if (applied) queue(document.body, true); });
  window.addEventListener("load", () => { detect(); setTimeout(detect, 1500); });
})();
