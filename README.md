# Mosaic Blanket Designer

PWA for designing mosaic crochet blanket charts. Convert images, paint stitches, generate written patterns, and export charts/PDFs. Works offline and can be installed on an iPhone Home Screen.

## Run locally

Serve the folder over HTTP (required for the service worker):

```bash
npx --yes serve .
```

Then open the URL shown in the terminal (usually `http://localhost:3000`).

## Install on iPhone

1. Deploy or open the site over **HTTPS** (GitHub Pages below).
2. In **Safari**, open the app URL.
3. Tap **Share** → **Add to Home Screen**.
4. Confirm the name and tap **Add**.

There is no Chrome-style install banner on iOS — Home Screen install is always via Share.

## GitHub Pages

This repo is set up for Pages from the `main` branch root:

- Live URL: `https://lutherfergus.github.io/mosaic/`

After the first deploy, wait a minute for Pages to build, then install from Safari.

## Features for mobile

- Installable PWA with offline caching
- Projects autosave in the browser (`localStorage`)
- Save Project / Export PNG use **Share** on iOS when available
- Sidebars collapse by default on narrow screens
- Safe-area padding for notch / home indicator

## Original prototype

The original standalone HTML zip is kept in [`archive/`](archive/).
