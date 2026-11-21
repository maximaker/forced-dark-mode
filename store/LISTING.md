# Chrome Web Store listing

**Name:** Forced Dark Mode

**Summary (132 chars max):**
Dark mode for sites that don't have one. Turn it on per site; it gets warmer and dimmer after sunset.

**Category:** Accessibility (alternative: Productivity)
**Language:** English

**Description:**

Dark mode for any website that doesn't offer one. Turn it on only where you want it.

HOW IT WORKS
• Flip the switch in the toolbar, press Alt+Shift+D, or right-click any page.
• Photos and videos keep their normal colours.
• Sites that already have a dark look are detected and left alone. You can still force it on.

FOLLOWS THE SUN
• Day: a neutral dark grey (not harsh pure black), slightly softened contrast.
• Evening: fades in over 40 minutes after sunset. Warmer (less blue light), dimmer, gentler contrast.
• Bedtime (optional): from a time you choose, the warmest and dimmest palette, for late reading.
• Sunset times come from your location (optional, stays on your device) or sensible defaults.
• Or pick Day, Evening or Bedtime yourself.

ALSO
• "Only when my system is dark": follows your Windows/macOS dark mode.
• A small coloured dot on the icon shows which palette the page is using.
• Your site list syncs across your Chrome browsers.

PRIVATE BY DESIGN
No accounts, no servers, no analytics. Nothing leaves your browser.

**Single purpose (for review):**
Applies a dark colour scheme to websites the user chooses, adjusted for time of day.

**Permission justifications:**
- Host permission (all sites, via content script): needed to apply the dark style to whichever sites the user turns it on for. Only the page's background colour is checked; content is never read or sent.
- storage: saves the user's settings and site list.
- geolocation: optional; used once, when the user clicks "Use my location", to calculate sunrise and sunset times. Stored locally, never transmitted.
- contextMenus: adds the "Dark mode on this site" right-click entry.
- activeTab: reads the current tab's address so the popup can show and toggle that site.

**Data usage:** Does not collect or use any user data. (Location is processed on the device only and never transmitted. Under the store's definitions, that isn't collection.)

**Privacy policy URL:** https://github.com/maximaker/forced-dark-mode/blob/main/PRIVACY.md

**Assets in this folder:** screenshot-1.png, screenshot-2.png (1280×800), promo-tile-440x280.png. Icon: icons/128.png.
