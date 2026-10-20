# Campus Food Exchange — Implementation Checklist

Target submission: October 26, 2026, 11:59 p.m. (confirm submission timezone).

Build a Connections Cafe proof of concept: staff-approved surplus offers, a live student price display, an animated sandwich case, and mock checkout. Label inventory, orders, and results as simulated. A live dining pilot is a separate milestone.

## 1. Agree on scope and ownership

- [ ] Confirm product name, branding, and approved imagery with Mateo.
- [ ] Confirm one integration/build owner and one submission owner.
- [ ] Confirm proposed responsibilities: Joey—pricing and checkout; Markian—inventory and staff controls; Sonia—research and permissions; Jake—economics and comparison; Mateo—visuals and pitch.
- [ ] Select three example products with different quantities and staff-defined sale windows.
- [ ] Agree that pilot prices cannot exceed each product's ordinary listed price.
- [ ] Use ten-minute price rounds as the initial demo setting; keep frequency configurable.
- [ ] Keep real payments, meal-plan changes, computer vision, and live Grubhub integration outside the required hackathon build.

## 2. App foundation and shared data

- [ ] Choose the web stack and create a runnable project with setup instructions.
- [ ] Create connected student and employee views using one authoritative application state.
- [ ] Define products: ID, name, image, ingredient/allergen information, ordinary price, and designated access protections.
- [ ] Define batches: ID, product ID, quantity, approved floor/ceiling, sale start, sale cutoff, and approval/pause status.
- [ ] Define inventory events: stocking, confirmed sale, removal, and count correction, with timestamps and reasons.
- [ ] Define versioned price records and quote/order records.
- [ ] Store currency in integer cents and use a consistent campus timezone.
- [ ] Add a simulated clock, seeded scenarios, and a reset-demo control.
- [ ] Preserve shared state across refreshes and synchronize changes between open views.

## 3. Pricing engine

Implemented as a deterministic module in `src/pricing.ts`, with tests and a simulated demo; see `README.md`. The module returns explanations, animation signals, and audit records. The future application must schedule evaluations, render animations, and persist records. Recent sales rate remains optional and is not included.

- [x] Implement an explainable rule using remaining stock and time to the approved cutoff.
- [x] Start with configurable surplus thresholds; treat recent sales rate as an optional input after the core rule works.
- [x] Enforce approved floor ≤ current price ≤ ordinary price on every update.
- [x] Reject missing, negative, or inverted price bounds and invalid sale windows.
- [x] Refresh prices at round boundaries using the authoritative clock.
- [x] Allow recovery from a discount up to ordinary price when the rule warrants it.
- [x] Show a plain-language reason for each change, such as “excess stock with 30 minutes left.”
- [x] Trigger a crash animation only for an eligible, approved markdown; do not guarantee a nightly crash.
- [x] Stop offer eligibility at cutoff regardless of price, quote duration, or animation state.
- [x] Pause dynamic offers when inventory is stale or the batch is unapproved.
- [x] Log price changes and their inputs for inspection.

## 4. Employee controls

- [ ] Add/edit products and batches, including quantities, bounds, and approved cutoffs.
- [ ] Approve, pause, resume, and end offers.
- [ ] Provide quick restock, removal, and count-correction actions.
- [ ] Display remaining quantity, last reconciliation time, current price, and next update.
- [ ] Show clear validation errors and stale-data warnings.
- [ ] Add a manager pause-all control and an explicit fallback state.
- [ ] Keep price refresh separate from physical recounting.
- [ ] Mark this as a demo staff screen; require authentication and role controls before live use.

## 5. Student display and animated glass case

- [ ] Apply Rochester-inspired blue/gold styling with the team's supplied branding.
- [ ] Display product photos, current and ordinary prices, stock status, and sale cutoff.
- [ ] Add mini price-history charts and a countdown to the next round.
- [ ] Use arrows and text alongside red/up and green/down colors.
- [ ] Build a stylized 2D Connections display case with sandwiches representing inventory.
- [ ] Animate confirmed purchases/removals and restocking from shared inventory events.
- [ ] Make price changes and case animations respond to the same underlying state.
- [ ] Explain that the case visualizes tracked inventory; it does not detect physical sandwiches.
- [ ] Add a brief market-crash animation with reduced-motion support.
- [ ] Provide readable mobile and large-display layouts, keyboard navigation, and sufficient contrast.
- [ ] Keep current prices understandable without watching animations or monitoring every update.

## 6. Mock checkout and inventory consistency

- [ ] Create a simulated ordering adapter behind an interface that could later connect to an authorized provider.
- [ ] Issue a timestamped quote tied to product/batch, quantity, price version, and expiry.
- [ ] Use a ten-minute quote duration initially; explicitly state that a quote does not reserve stock.
- [ ] Charge the lower of the valid quoted price and current price.
- [ ] Require explicit acceptance of a fresh quote after expiry.
- [ ] Recheck stock, eligibility, cutoff, and price when accepting an order.
- [ ] Accept the order and decrement inventory as one operation; prevent duplicate orders and negative stock.
- [ ] Preserve the accepted order price even if the display changes later.
- [ ] Provide a staff/kiosk quote route for students without phones.
- [ ] Document queue grace and collection-cutoff behavior; never extend a food-sale cutoff.
- [ ] Model cancellation/refund events; return stock only after an explicit eligibility decision.
- [ ] On sync failure, stop accepting dynamic orders and show the fallback; do not sell cached expired offers.

## 7. Comparison simulation

- [ ] Implement ordinary pricing, a fixed markdown, and adaptive offers.
- [ ] Use identical starting stock, sale windows, exposure, and underlying demand assumptions across strategies.
- [ ] State how simulated demand responds to price; do not assume every discounted sale is additional.
- [ ] Make scenarios repeatable and expose assumptions to the viewer.
- [ ] Include strategic-waiting sensitivity scenarios of 0%, 25%, and 50%, labeled as assumptions.
- [ ] Report units sold, remaining units, receipts/redemptions, displaced purchases, and incremental operating costs.
- [ ] Separate cash receipts from prepaid Dining Dollar redemptions.
- [ ] Show how labor and packaging costs affect the comparison.
- [ ] Label leftovers as potential surplus, not automatically verified waste or landfill diversion.
- [ ] Present simulations as demonstrations of behavior, not measured campus outcomes.

## 8. Verify the complete demo

- [ ] Verify restocking → pricing → student display → quote → purchase → inventory update across both views.
- [ ] Check pricing bounds, round transitions, quote expiry, and sale cutoffs using the simulated clock.
- [ ] Check a falling price during a quote and a rising price below the ordinary-price ceiling.
- [ ] Check two simultaneous attempts to buy the last item and duplicate checkout submissions.
- [ ] Check pause, stale inventory, disconnected screens, sold-out items, cancellations, and refunds.
- [ ] Verify that quote locks and queue handling never bypass cutoffs.
- [ ] Verify reduced motion, no-phone checkout, and color-independent price labels.
- [ ] Run a complete demo from a clean reset and fix blocking failures.

## 9. Package for submission

- [ ] Deploy a reviewable demo and confirm its link works on another device.
- [ ] Prepare a short walkthrough: surplus appears → markdown → protected purchase → stock update → cutoff.
- [ ] Include one failure scenario and the fixed-markdown comparison.
- [ ] Add a visible simulation notice and a clear list of unconfirmed integrations.
- [ ] Prepare backup screenshots/video and local run instructions.
- [ ] Confirm permission for any campus photos, interview quotes, or recordings used publicly.
- [ ] Align deck, demo, and research brief around the same no-surge pilot.
- [ ] Confirm required submission materials, team contributions, deadline timezone, and submission owner.

## 10. Investigate Grubhub and Connections in parallel

These are discovery tasks, not promises of a working integration by submission.

- [ ] Identify Connections' dining sponsor, menu/POS owner, and Grubhub technical contact.
- [ ] Confirm which system controls prices and which system owns accepted orders.
- [ ] Ask whether authorized menu updates, item-level sales events, and test access are available.
- [ ] Confirm permitted update frequency, propagation delay, and failure behavior.
- [ ] Map app and counter products, batches, payment routes, and inventory sources.
- [ ] Verify how Dining Dollars and meal-swipe eligibility affect each proposed offer.
- [ ] Confirm order acceptance, cancellations, refunds, and stock synchronization behavior.
- [ ] Document access requirements and unresolved dependencies; retain mock checkout if access is unavailable.

## 11. Validate low-workload inventory tracking

- [ ] Observe the existing stocking, checkout, removal, and reconciliation workflow with permission.
- [ ] Determine which events staff already record and which can be reused through authorized access.
- [ ] Account for counter sales as well as app sales; sales alone do not establish current stock.
- [ ] Trial opening batch counts plus sales, replenishment, removal, and correction events for a few products.
- [ ] Measure additional staff time, count error, and reconciliation frequency.
- [ ] Agree when uncertain inventory must pause an offer.
- [ ] Use Winnow history only for validated purposes; confirm fields and access before claiming item-level inventory.
- [ ] Treat cameras/shelf sensors as later experiments requiring approval and accuracy testing.
- [ ] Describe the goal as minimal additional work until zero-work operation is demonstrated.

## 12. Gates before any live dining pilot

- [ ] Confirm recurring, eligible edible surplus at Connections through approved observation.
- [ ] Obtain dining approval for products, price authority, cutoffs, checkout, collection, and fallback procedures.
- [ ] Agree dietary-access protections and preserve ingredient/cross-contact information.
- [ ] Protect existing donation commitments and record the actual alternative destination of surplus.
- [ ] Add staff authentication, authorization, durable audit records, and production monitoring.
- [ ] Validate the authorized ordering integration and reconcile prices and inventory end to end.
- [ ] Establish a baseline for whole-day economics, edible discards, donations, staff effort, and service access.
- [ ] Agree numerical success/stop thresholds with dining before collecting trial results.
- [ ] Run shadow recommendations before an authorized offer trial.
- [ ] Compare against normal practice and a fixed markdown, including students' actual consumption where feasible.
- [ ] Expand only if benefits justify operating costs; prefer simpler markdowns or smaller production batches when they perform as well.
