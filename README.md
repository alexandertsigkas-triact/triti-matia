# Τρίτη Ματιά · Third Look

A mobile web app that reads a photo with the P·L·T method (Polycontexturality · Liminality · Transjunction), created by Alexander Tsigkas (Triact, triact.gr).

Take or choose a photo of a building or space, a workplace or process, a value stream map, an artwork, or anything else. The app returns, in plain words:

1. **Which logics meet** in the scene, what each one wants, and what in the photo shows it.
2. **Where they meet**: the thresholds, marked as numbered points on the photo.
3. **What would bring them into contact**: small, testable moves, each with a way to check that it works.
4. **The easy fix that hides the problem**, the open questions, and what one photo cannot show.

**Value stream maps (VSM):** in this mode the app also reads the map's data boxes and inventory triangles into an editable table (C/T, C/O, uptime, operators, stock) and calculates production lead time, value-added time and share, takt time and the bottleneck. The figures are computed by the page from the table, not by the model, and recalculate when you correct a value.

A switch shows the P·L·T terms (K, L, T, false third) for readers who know the method. The interface is in Greek and English.

## How it works

The whole app is one file, `index.html`. It runs as a Claude artifact and asks Claude to read the photo through the artifact's `sample` capability (with images enabled). The viewer must be signed in to Claude; the first analysis asks for their permission.

Before sending, the photo is scaled down to at most 1568 px on its longer side and re-encoded as JPEG. This also removes location and camera data. The last six analyses are kept only in the viewer's browser.

## Running it elsewhere

Outside claude.ai there is no `sample` capability, so the page shows the built-in example and explains that analysis needs a Claude sign-in. To offer analysis without a Claude account, the page needs a small server that calls the Claude API with your own key; the prompt and the expected JSON shape are in the `prompt()` function of `index.html`.

## Subscription version

The `server/` folder holds a server that offers the app by subscription: email sign-in, monthly analysis limits per plan, card payments through Stripe and analysis through Triact's own Claude API key. It runs in a complete test mode without any keys. See [server/README.md](server/README.md).

## Published version

https://claude.ai/artifact/2N65xoDK5yHVCnrrpkjKfN
