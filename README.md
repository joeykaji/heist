# MarketBite / Connections Cafe

Five connected browser views:
- ?view=home — company goals, sustainability story and verified team LinkedIn links.
- ?view=tv — 16:9 menu with the adjustable 3D case, shared time slider, Play/Restart, a compact Move the Market event launcher, and charts underneath. ?display=1 opens the clean TV display; legacy ?view=simulation links open Cafe Display.
- ?view=mobile — scrollable food menu, search, category sheet, deals, day playback, simulated basket, and a second phone showing simulated home-screen notifications below the preview.
- ?view=sustainability — resource goals, demo food movement and future pilot measurement.
- ?view=inventory — all detailed customization: hours, food names/tickers/photos/categories, enabled foods, stock, prices, floors/costs, new foods, traffic rates, rushes, fresh deliveries, recounts, offer review and deals.

Run: node server.mjs (http://127.0.0.1:4173). Test: node --test test/*.test.mjs.
Static deployment root: dist. Existing Site identity is retained in .openai/hosting.json.

## Pricing and inventory

dist/pricing.mjs implements the equations/status order in the user-supplied MarketBite Pricing Specification 1.1 / Engine 2.1 using Decimal arithmetic (40-digit precision). Candidate cents round upward; fees and expectations retain decimal precision. Unknown required economics/scenario evidence returns REVIEW. Approval flags default false in the engine.

The browser demo adapter in model.mjs explicitly supplies synthetic, reviewed-for-demo fixtures. These fixtures are not claims about Connections Cafe's economics or customer demand. Each batch/window may commit one evaluated HOLD or one acknowledged MARKDOWN. Restocking creates a separate fresh batch; it never relabels residual inventory. Recommendation, authorization, simulated acknowledgment and publication are separate functions/states. Failed simulated checkout updates do not publish a lower price.

Physical stock, reserved units, protected allocations and buffer units are distinct. Offer stock is I-R-G-B. New offers withdraw five minutes before the configured closing time (3 PM by default); simulated observations refresh every replay tick. At closing, protected stock is recorded as transferred and remaining physical units as retained, not automatically discarded. Those are scripted ledger outcomes, not verified sustainability impact.

Stock crash and Closing Rush events request guarded evaluations; they do not force markdowns. Food pairings use independently confirmed item prices, without a shared-stock bundle discount or joint optimization. Price charts show an individual batch's positive confirmed prices and stop at withdrawal. The demand graph shows the configured purchases per hour across both channels.

## Limits

Browser-local prototype, no POS, Grubhub, payment, actual orders, or cross-device service. localStorage synchronizes tabs on one origin; Web Locks serialize supported-browser mutations. No claim of real-world approval, demand calibration, carbon savings, or production checkout readiness. Accepted demo purchases are fulfilled immediately at the quoted batch price; operational cancellations, refunds and a durable authoritative ledger require a server/POS integration.

Menu data comes from the supplied screenshots; duplicate Muffin/Chocolate Croissant listings were consolidated. All distinct food products are included; drinks are excluded. AI-generated food photos are representative, and each bagel variety has an individual image. Logos are user-supplied. image-notes.txt and image-prompts.json describe image provenance.

The 3D scene shows up to nine enabled foods, up to eight individual models per food. Active pairing foods take priority. Additional units are explicitly counted as back stock; the full menu inventory appears at the Cafe Desk. Sandwiches and bagels occupy the bottom and middle shelves; pastries occupy the top. Visible unit animations also show sales replenished from back stock.

Applying inventory or hours rebuilds the current point in the day from the saved plan; this replaces manual events in that run. Restart returns to opening and pauses. Receiving food creates a fresh batch with editable price, floor and cost; existing batches retain their confirmed price and commitment history. Illustrative default traffic is 12 in-person purchases and 8 mobile orders per normal hour, doubled during breakfast and lunch. Closing Rush starts at 2 PM at 0.8× normal traffic. Cafe Desk accepts 0–200 hourly purchases per channel and 0.1–5× rush multipliers over 5–120 minutes. Purchases require available stock; a paired mobile basket counts as one order and two items. Seeking and playback use the same deterministic purchase schedule. Pairing, bakery review and Closing Rush announcements share confirmed prices across all views.

## Verification

Tests cover price rounding/floors, fees and activation, scenario caps, missing and invalid inputs, strict/inclusive gates, downside protection, weight normalization, tie-breaking, holds, idempotence, failed publication, stale execution, reserved/protected stock, new batch identity, exact basket allocation, cutoff behavior, state validation and a conserved day replay. Browser checks cover the TV, mobile search/basket/category flow, 3D renderer and event controls.

Vendors: Three.js 0.160.1 (MIT); Decimal.js 10.4.3 (MIT). Both are served locally; license notices remain in the files.

Cafe hours default to 7 AM–3 PM. Cafe Desk accepts same-day hours at least two hours apart. Playback, charts, review windows, arrivals, and closing follow those hours. Rush shortcuts outside opening hours stay saved but cannot launch. Earlier saved plans migrate while retaining custom menu prices and current price histories; the old run is backed up locally. Fonts: DM Sans and Manrope (SIL OFL, notices in assets), with Roboto Slab branding. The Rocky Yellowjacket image is user-supplied.
