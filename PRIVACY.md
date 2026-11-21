# Privacy policy: Forced Dark Mode

_Last updated: 21 November 2026_

Forced Dark Mode does not collect, send or sell any data. It has no servers, no analytics and no tracking.

## What it stores, and where

- **Your settings and the list of sites where you turned dark mode on.** Stored with `chrome.storage.sync`, so Chrome can sync them between your own browsers if you use Chrome sync. Nobody else can see them.
- **Your approximate location, only if you click "Use my location".** It's used to work out local sunrise and sunset times. It is rounded to about 1 km, stored only on your device (`chrome.storage.local`) and never sent anywhere.
- **Which sites already look dark.** Saved on your device so the extension can skip them faster next time.

## Permissions

- **Read and change pages on all sites:** needed to apply the dark style to the sites you choose. Page content is never read, stored or sent. The extension only checks a page's background colour to tell whether the site is already dark.
- **Storage:** saves your settings, as described above.
- **Geolocation:** used only when you click "Use my location".
- **Context menus:** adds the "Dark mode on this site" entry to the right-click menu.

## Contact

Questions: open an issue at https://github.com/maximaker/forced-dark-mode/issues
