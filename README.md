# MarketBite / Connections Cafe

Three connected browser views:
- ?view=tv — 16:9 menu studio; ?display=1 opens the clean TV display.
- ?view=simulation — adjustable 3D case, day replay, inventory, events and pricing diagnostics.
- ?view=mobile — scrollable food menu, search, category sheet, deals and simulated basket.

Run: node server.mjs (http://127.0.0.1:4173). Test: node --test test/*.test.mjs.
Static deployment root: dist. Existing Site identity is retained in .openai/hosting.json.

## Pricing and inventory

dist/pricing.mjs implements the equations/status order in the user-supplied MarketBite Pricing Specification 1.1 / Engine 2.1 using Decimal arithmetic (40-digit precision). Candidate cents round upward; fees and expectations retain decimal precision. Unknown required economics/scenario evidence returns REVIEW. Approval flags default false in the engine.

The browser demo adapter in model.mjs explicitly supplies synthetic, reviewed-for-demo fixtures. These fixtures are not claims about Connections Cafe's economics or customer demand. Each batch/window may commit one evaluated HOLD or one acknowledged MARKDOWN. Restocking creates a separate fresh batch; it never relabels residual inventory. Recommendation, authorization, simulated acknowledgment and publication are separate functions/states. Failed simulated checkout updates do not publish a lower price.

Physical stock, reserved units, protected allocations and buffer units are distinct. Offer stock is I-R-G-B. New offers withdraw five minutes before the 6 PM cutoff; simulated observations refresh every replay tick. At closing, protected stock is recorded as transferred and remaining physical units as retained, not automatically discarded. Those are scripted ledger outcomes, not verified sustainability impact.

Stock crash and last-call events request guarded evaluations; they do not force markdowns. Study Buddy is an independently priced food pairing, without a shared-stock bundle discount or joint optimization. Price charts show an individual batch's positive confirmed prices and stop at withdrawal. Demand is a separate scripted index.

## Limits

Browser-local prototype, no POS, Grubhub, payment, actual orders, or cross-device service. localStorage synchronizes tabs on one origin; Web Locks serialize supported-browser mutations. No claim of real-world approval, demand calibration, carbon savings, or production checkout readiness. Accepted demo purchases are fulfilled immediately at the quoted batch price; operational cancellations, refunds and a durable authoritative ledger require a server/POS integration.

Menu data comes from the supplied screenshots; duplicate Muffin/Chocolate Croissant listings were consolidated. All distinct food products are included; drinks are excluded. AI-generated food photos are representative, and bagel flavors share a category photo. Logos are user-supplied. image-notes.txt and image-prompts.json describe image provenance.

The 3D scene shows nine representative foods, up to eight individual models per food. Additional units are explicitly counted as back stock; the full menu inventory appears in the inventory panel.

## Verification

Tests cover price rounding/floors, fees and activation, scenario caps, missing and invalid inputs, strict/inclusive gates, downside protection, weight normalization, tie-breaking, holds, idempotence, failed publication, stale execution, reserved/protected stock, new batch identity, exact basket allocation, cutoff behavior, state validation and a conserved day replay. Browser checks cover the TV, mobile search/basket/category flow, 3D renderer and event controls.

Vendors: Three.js 0.160.1 (MIT); Decimal.js 10.4.3 (MIT). Both are served locally; license notices remain in the files.
