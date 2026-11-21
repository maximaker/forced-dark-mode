// Palette engine, shared by content.js and popup.js.
// Works out sunrise/sunset, then blends Day -> Evening -> Bedtime with gentle fades.
var FDM = (() => {
  const rad = Math.PI / 180;
  const MIN = 60 * 1000;
  const DAY_MS = 24 * 60 * MIN;
  const FADE = 40 * MIN;      // day <-> evening fade after sunset / after sunrise
  const BED_FADE = 20 * MIN;  // evening -> bedtime fade

  // Filter settings: invert, sepia (warmth), brightness, contrast.
  // Day: neutral dark grey (~#1c1c1c, never pure black), slightly softened contrast.
  // Evening: warmer (less blue light), dimmer, lower contrast for adjusted eyes.
  // Bedtime: warmer and dimmer still, for reading in a dark room.
  const PALETTES = {
    day:     { i: 0.89, s: 0,    b: 1,    c: 0.95 },
    evening: { i: 0.90, s: 0.30, b: 0.85, c: 0.88 },
    bedtime: { i: 0.92, s: 0.55, b: 0.70, c: 0.85 },
  };

  // NOAA-style sunrise equation. Returns { sunrise, sunset } Dates, or null (polar day/night).
  function sunTimes(date, lat, lon) {
    const ms = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const n = Math.round(ms / 86400000 + 2440587.5 - 2451545.0 + 0.0008);
    const jStar = n - lon / 360;
    const M = (357.5291 + 0.98560028 * jStar) % 360;
    const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
    const L = (M + C + 180 + 102.9372) % 360;
    const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
    const decl = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
    const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) /
                 (Math.cos(lat * rad) * Math.cos(decl));
    if (cosH < -1 || cosH > 1) return null;
    const H = Math.acos(cosH) / rad;
    const toDate = (j) => new Date((j - 2440587.5) * 86400000);
    return { sunrise: toDate(jTransit - H / 360), sunset: toDate(jTransit + H / 360) };
  }

  // Sun times for a day, falling back to 07:00 / 19:30 without a saved location.
  function times(date, loc) {
    const t = loc && sunTimes(date, loc.lat, loc.lon);
    if (t) return t;
    const d = (h, m) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
    return { sunrise: d(7, 0), sunset: d(19, 30) };
  }

  const clamp = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => ({
    i: a.i + (b.i - a.i) * t, s: a.s + (b.s - a.s) * t,
    b: a.b + (b.b - a.b) * t, c: a.c + (b.c - a.c) * t,
  });

  // 0 = full day, 1 = full evening. Fades in over 40 min after sunset, out over 40 min after sunrise.
  function eveningness(now, loc) {
    const { sunrise, sunset } = times(now, loc);
    const t = +now;
    if (t < sunrise) return 1;
    if (t < sunset) return 1 - clamp((t - sunrise) / FADE);
    return clamp((t - sunset) / FADE);
  }

  // 0..1 bedtime strength: fades in from the bedtime hour, lasts until the next sunrise.
  function bedtimeness(now, loc, bedtime) {
    if (!bedtime) return 0;
    const [h, m] = bedtime.split(":").map(Number);
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    if (start > now) start = new Date(+start - DAY_MS);
    const sunriseDay = start.getHours() >= 12 ? new Date(+start + DAY_MS) : start;
    const end = +times(sunriseDay, loc).sunrise + FADE;
    if (+now >= end) return 0;
    return clamp((now - start) / BED_FADE);
  }

  // settings: { mode: "auto"|"day"|"evening"|"bedtime", bedtimeOn, bedtime: "HH:MM" }
  // Returns { label, filter, transitioning }
  function compute(now, loc, settings) {
    const mode = settings.mode || "auto";
    let p, label, transitioning = false;
    if (mode !== "auto") {
      p = PALETTES[mode] || PALETTES.day;
      label = PALETTES[mode] ? mode : "day";
    } else {
      const e = eveningness(now, loc);
      const b = Math.min(bedtimeness(now, loc, settings.bedtimeOn ? settings.bedtime : ""), e);
      p = lerp(lerp(PALETTES.day, PALETTES.evening, e), PALETTES.bedtime, b);
      label = b > 0.5 ? "bedtime" : e > 0.5 ? "evening" : "day";
      transitioning = (e > 0 && e < 1) || (b > 0 && b < 1);
    }
    const f = (x) => x.toFixed(3);
    return {
      label,
      transitioning,
      filter: `invert(${f(p.i)}) hue-rotate(180deg) sepia(${f(p.s)}) brightness(${f(p.b)}) contrast(${f(p.c)})`,
    };
  }

  return { sunTimes, times, compute, PALETTES };
})();
