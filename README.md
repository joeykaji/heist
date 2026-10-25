# MarketBite Café Display

A working café menu application with a fixed 1920 × 1080 (16:9) TV view, six food photographs, current/previous prices, a scrolling market ticker, local inventory controls and a replayable café-day simulation.

Run with Node.js: `npm run dev`. Open http://127.0.0.1:4173. Add `?display=1` for TV-only mode. Press F or use Full screen.

The studio and TV view sync through localStorage on the same origin and browser profile. Data persists through refresh. This is a single-browser demo, not a multi-device inventory service or checkout integration. The app is private when hosted through Sites.

Run checks: `npm test`.

Prices use integer cents. Same-batch discounts move through 0%, 15%, 30%, 45%; fresh restocks create separate regular-price batches. The display labels mixed batches, sells the lowest-priced available batch first, prevents negative stock, and expires offers at 6 PM in the simulated day. Manual markdowns are restricted to the final two hours. The actual clock and data-update timestamp use America/New_York.

The 60-second default replay compresses 8 AM–6 PM. All prices, inventory, activity and generated food images are illustrative. Surplus sales are counted; carbon savings are not invented. Food image prompts and provenance are in dist/image-notes.txt.
