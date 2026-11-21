// Fake chrome.* APIs so popup.html can be rendered outside the extension (screenshots only).
(() => {
  const q = new URLSearchParams(location.search);
  const data = {
    sync: { sites: { "www.vinted.ro": true, "www.emag.ro": true, "news.ycombinator.com": true, "en.wikipedia.org": true },
            mode: q.get("mode") || "auto", bedtimeOn: q.get("bed") === "1", bedtime: "23:00", followSystem: false },
    local: { location: { lat: 47.16, lon: 27.59 } },
    session: { tab1: q.get("state") || "evening" },
  };
  const area = (k) => ({
    get: (def, cb) => {
      let out;
      if (typeof def === "string") out = { [def]: data[k][def] };
      else out = Object.assign({}, def, data[k]);
      cb && cb(out); return Promise.resolve(out);
    },
    set: (v) => { Object.assign(data[k], v); return Promise.resolve(); },
  });
  window.chrome = {
    storage: { sync: area("sync"), local: area("local"), session: area("session"), onChanged: { addListener() {} } },
    tabs: { query: () => Promise.resolve([{ id: 1, url: "https://" + (q.get("host") || "www.vinted.ro") + "/" }]) },
  };
  if (q.get("now")) { const fixed = +new Date(q.get("now")); const D = Date; window.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(fixed); } static now() { return fixed; } }; }
})();
