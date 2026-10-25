# MarketBite / Connections Cafe

Six connected browser views:
- ?view=home — company goals, sustainability story and verified team LinkedIn links.
- ?view=tv — 16:9 menu with the adjustable 3D case, shared time slider, customizable rushes, events and charts underneath. ?display=1 opens the clean TV display; legacy ?view=simulation links open Cafe Display.
- ?view=exchange — Joey's Exchange TV with rotating prices, availability and price-history charts, using the same Cafe Desk settings and day as the other displays.
- ?view=mobile — scrollable food menu, search, category sheet, deals, day playback, simulated basket and live alert bubbles below the preview.
- ?view=sustainability — resource goals, demo food movement and future pilot measurement.
- ?view=inventory — collapsible Cafe Desk sections for hours, editable foods and prices, fresh deliveries, recounts, pricing review, deals and customer traffic.

Run: `npm ci`, `npm run build:pricing`, then `npm run dev` (http://127.0.0.1:4173).
Test: `npm test` (source contract, website/model integration, and isolated legacy suite).
Type check: `npm run typecheck`. Scenario CLI: `npm run demo`.
Static deployment root: dist. Existing Site identity is retained in .openai/hosting.json.

## Pricing and inventory

The active pricing controller is `src/domain/dynamic.mjs`. Both browser-local and server-backed demos evaluate every **30 simulated minutes**, on the hour and half hour. Purchases accumulate between reviews; they do not immediately change the price. Staff can still preview and explicitly acknowledge a manual adjustment.

For each batch, available units are physical stock minus reservations, protected allocations and buffer stock. A fixed reference quantity is recorded when the batch is received. Window progress runs from receipt to cutoff. The target is:

`regular price × (1 − 0.45 × window progress × min(1, available / reference quantity))`

Target prices round upward to whole cents using exact rational arithmetic. The floor is the maximum of one cent, merchant floor, 55% of regular price, and `(sale cost + fixed order fee + required contribution) / (1 − fee fraction)`, rounded upward. An individual adjustment is limited to 5% of regular price (rounded up), except when meeting a higher binding floor requires a larger correction. Prices can fall as time passes or rise as purchases reduce unallocated stock; they never exceed regular price. This is a configurable stock/time rule, not a calibrated demand forecast or profit optimizer.

The demo checkout adapter automatically acknowledges scheduled adjustments; manual recommendations still require authorization and acknowledgment. Pending or uncertain checkout operations exclude the batch from automatic updates. Checkout versions reject stale quotes; accepted orders retain their quoted price. A browser basket is quoted atomically before any later scheduled review.

Offers require reviewed economics, approval, supported checkout and a fresh inventory count. Counts older than 30 minutes pause availability; new orders stop five minutes before cutoff. Server counts require staff reconciliation, while browser playback supplies synthetic observations. Restocking creates a separate fresh batch and reference quantity. At closing, protected units transfer and remaining stock is retained in the simulated ledger.

Charts connect a reduced set of confirmed samples. They display at most 32 samples, grouped into half-hour buckets, while the exact history table retains every confirmed event. Exchange TV and mobile food cards include hourly price markers. Connecting segments illustrate the trend; checkout prices remain fixed between reviews. Existing saved histories are simplified for display without deleting events.

The previous scenario optimizer remains in `src/domain/decide.mjs` and `dist/pricing.mjs` for compatibility and historical tests; it no longer controls the active demos. `npm run build:pricing` generates both engines. The earlier continuous TypeScript engine remains isolated under legacy scripts.

## Limits

Browser-local prototype, no POS, Grubhub, payment, actual orders, or cross-device service. localStorage synchronizes tabs on one origin; Web Locks serialize supported-browser mutations. No claim of real-world approval, demand calibration, carbon savings, or production checkout readiness. Accepted demo purchases are fulfilled immediately at the quoted batch price; operational cancellations, refunds and a durable authoritative ledger require a server/POS integration.

Menu data comes from the supplied screenshots; duplicate Muffin/Chocolate Croissant listings were consolidated. All distinct food products are included; drinks are excluded. AI-generated food photos are representative, and each bagel variety has an individual image. Logos are user-supplied. image-notes.txt and image-prompts.json describe image provenance.

The 3D scene shows nine representative foods, up to eight individual models per food. Additional units are explicitly counted as back stock; the full menu inventory appears at the Cafe Desk. Sandwiches occupy the bottom and middle shelves; pastries occupy the top.

Cafe Desk can add or hide foods, edit names, symbols, photos, prices and stock, and configure deals and arrivals. Applying an opening plan rebuilds the current simulated time from that plan; receiving food creates a separate fresh batch. Normal traffic defaults to 12 in-person and 8 mobile purchases per hour, with adjustable breakfast/lunch multipliers and a quieter Closing Rush at 2 PM. These are synthetic demo rates. Moving the slider rebuilds the day from the saved plan, and Restart returns to opening time paused. Pairing, bakery price-drop and Closing Rush announcements share confirmed prices across the displays and notification phone.

## Verification

`npm test` covers the archived scenario contract, active dynamic targets/floors, bidirectional changes, half-hour timing, simplified charts, exact basket allocation, authorization and failed publication, stale execution, reservation and fulfillment, protected stock, separate fresh batches, persistence and conserved deterministic day replay. `npm run typecheck` checks TypeScript compatibility.

Vendors: Three.js 0.160.1 (MIT); Decimal.js 10.4.3 (MIT). Both are served locally; license notices remain in the files. Fonts: DM Sans and Manrope (SIL OFL, notices in assets), with Roboto Slab branding.

Cafe hours default to 7 AM–3 PM. Cafe Desk accepts same-day hours at least two hours apart; applying them rebuilds the saved opening plan at the current time, bounded by the new hours. Replay, arrivals, pricing and closing follow those hours.

## Shared server demo

The homepage and its six browser-local views remain at `/`. The server-backed flow uses `/shop`, `/market`, `/staff`, and `/offers/:offerId`. These routes share one authoritative session; the homepage simulation has separate browser-local state.

Run `npm ci` and `npm run dev`, then open Shop, Market, and Staff in separate tabs at http://127.0.0.1:4173. This flow requires the Node server; a static `dist` deployment alone cannot serve its API. Commands serialize on the server, persist to `.marketbite/session.json`, and broadcast full revisioned snapshots over SSE. Reconnecting tabs receive the current snapshot. Reset creates a new generation and invalidates old commands.

Walkthrough: at Staff, reset, select the first batch, choose the stock/time preview, and review pricing. Authorize the recommendation: Market retains the regular price while checkout is pending. Acknowledge it to publish the markdown. In Market select that batch and follow “Buy this exact offer”; confirm a simulated purchase, then fulfill its reservation at Staff. Both availability displays and the exchange tape update. To demonstrate failure, reject a publication or simulate a timeout and reconcile it. Advancing 31 minutes makes opening counts stale; reconcile counts explicitly to restore eligibility. New orders close five minutes before collection cutoff.

The shared flow uses synthetic products and economics, no real payments, and no staff authentication. It reserves accepted orders until explicit fulfillment. Keyboard focus and form drafts survive live updates; narrow layouts expose connection status and a skip link reaches the main content. Browser acceptance results and screenshots are recorded in [docs/verification/browser-acceptance.md](docs/verification/browser-acceptance.md), including remaining accessibility checks.

The Market route includes a market-wide confirmed-price trend chart: toggle dollars or percentage change from regular price, select a batch in its legend, or expand the exact price-event table. Each delivery retains its own batch history. Pending recommendations never enter the graph; lines stop at cutoff, count expiry, or staff withdrawal.

## Secondary Exchange TV

From the homepage, choose **Exchange TV** in the navigation or beside Cafe Display’s TV launch button. `/?view=exchange` provides preview, previous/next page, pause rotation, and fullscreen controls. `/?display=exchange` opens the clean 16:9 screen. Enabled Cafe Desk foods rotate across pages of twelve every 15 seconds; reduced-motion preference starts rotation paused.

This secondary TV shares the browser-local Cafe Desk/playback state, just like Cafe Display and Mobile Display. It shows confirmed batch prices, crossed-out original prices, available quantities, and small trend charts. Each chart is relative to that batch’s regular price. Fresh stock never joins an old batch’s line. Its countdown is for page rotation, not a promised price change. The server-backed `/market` session remains separate.

Exchange TV’s simulation preview includes Play/Pause, Restart, a five-minute step, speed, and a day scrubber. These use the same replay engine as Cafe Display and Mobile Display; seeking rebuilds from the saved opening plan. Playback controls are hidden in standalone TV (`?display=exchange`) and fullscreen presentation.
