# Delivery and verification

## Milestone 1: runnable branded shell

- Establish web/server layout, scripts, shared type boundaries, and dependency lockfile.
- Copy and crop the supplied logo; add design tokens and responsive storefront, market terminal, offer-detail, and staff routes.
- Render the same three static offers as storefront cards and terminal quotes, with linked offer details and intentional empty/history states.
- Keep static mock data visibly labeled until authoritative state is connected.

Done when a documented command opens a usable branded storefront, market terminal, and staff view on desktop and mobile, with no missing assets or console errors.

## Milestone 2: pricing contract

- Implement the separate scenario decision module described in plan 02.
- Create independently calculated synthetic fixtures for MARKDOWN, evaluated HOLD, REVIEW, and PAUSE.
- Preserve legacy tests during migration; label them as legacy.
- Document any ambiguity resolved from the PDF and avoid claiming absent Python-reference parity.

Done when the contract tests pass, diagnostics explain all candidate gates, and no recurring/upward pricing exists in the new engine.

## Milestone 3: shared state and operational controls

- Implement the server-owned session, revisioned commands, idempotency, persistence, and event stream.
- Add seeded clock, pause/advance/reset, count reconciliation, approvals, pause/resume, closure, and available-unit calculation.
- Connect storefront, market terminal, and staff view to the same session; route navigation preserves it.
- Implement reconnect/gap recovery and explicit disconnected states.

Done when all three views agree after commands, restart preserves state, duplicate commands do not duplicate effects, and reset invalidates pending old-generation work.

## Milestone 4: complete decision-to-purchase flow

- Staff reviews diagnostics and authorizes the exact recommendation.
- Mock checkout acknowledges or rejects publication; only confirmed events affect the chart and current price.
- Evaluated HOLD commits without changing price.
- Mock order acceptance reserves inventory atomically; fulfillment releases the reservation and removes physical stock.
- Add success/failure feedback, timing/freshness withdrawal, and cutoff handling.

Done when a complete flow passes through storefront, terminal, and staff views and failures cannot publish unconfirmed prices or oversell stock.

## Milestone 5: presentation polish and handoff

- Finish step charts, savings labels, activity feed, selection, fullscreen, and subtle event animations.
- Verify keyboard use, contrast, narrow layouts, reduced motion, and readable presentation mode.
- Update README with setup, reset, assumptions, architecture, known limitations, and scenario walkthrough.
- Replace the old CLI behavior with a new-contract demo, or clearly isolate it as legacy.
- Capture screenshots or a short local recording only after the seeded flow is stable.

Done when a clean install/build and the acceptance matrix pass. Publishing a hosted demo is a separate action; prepare a deployable build without assuming a hosting provider.

## Acceptance matrix

| Case | Expected result | Verification layer |
|---|---|---|
| Storefront/terminal synchronization | Same offer price/version, stock, status, and deadline after events | Integration/browser |
| Terminal offer link | Opens exact storefront offer; no product/batch substitution | Browser |
| Direct route load and refresh | Offer and terminal selection restore without resetting session | Browser |
| Storefront purchase | One order/reservation; terminal activity and both availability displays update | Integration/browser |
| Failed publication | Neither public view shows the recommended price | Integration/browser |
| Known economic fixture | Exact floor, gains, gates, and selected price | Domain tests |
| Same-batch upward attempt | Rejected; confirmed price unchanged | Domain/application |
| Evaluated HOLD then review again | Commitment blocks second decision | Application |
| Administrative HOLD/REVIEW | No commitment or fabricated forecast | Domain/application |
| Recommendation before acknowledgment | Board retains only valid confirmed offer | Integration/browser |
| Checkout rejection | No markdown count/commitment/price event | Integration |
| Timeout with unknown result | Pending reconciliation; no duplicate publication | Integration |
| Inventory/policy changes during publication | Stale recommendation cannot publish as available | Integration |
| Two attempts at last unit | Exactly one acceptance | Application concurrency |
| Duplicate purchase request | Same order returned, one reservation | Application |
| Fulfillment | Physical and reserved counts both fall once | Application |
| Protected allocation | Never becomes purchasable stock | Domain/application |
| Count becomes stale | New acceptance disabled; status explicit | Clock/application |
| Fulfillment buffer/cutoff crossed | Withdrawal at buffer; no late new acceptance | Boundary tests |
| New stock after commitment | New batch; old residual identity unchanged | Application |
| Client disconnect/reconnect | Purchases disabled offline; revision catch-up correct | Browser/integration |
| Server restart | State retained; pending operation reconciled | Persistence |
| Reset during delayed acknowledgment | Old callback ignored | Integration |
| Closed chart | Ends at last valid price; no zero point | Browser |
| Mobile/keyboard/reduced motion | Core operations usable without animation/color | Browser/manual |

Use focused automated tests for economic rules and state transitions. Use a small browser smoke suite for connected views and purchase/publication flow, plus manual visual review at wide and narrow sizes. Avoid tests that merely duplicate styling implementation.

## Seeded presentation script

1. Reset to an explicit synthetic session with three approved products. Open Shop, Market, and Staff in separate tabs. Show shared branding, offers, protected allocation, and simulation notice.
2. Review product A, whose fixture has an admissible markdown. Show the gain/downside/uplift diagnostics.
3. Authorize it and pause briefly at pending checkout to show that the public price has not changed.
4. Acknowledge checkout. Show the storefront price update alongside one downward terminal-chart step, ticker update, savings, and an activity event.
5. Follow the terminal’s selected offer link to its storefront detail. Submit a simulated purchase; show reservation and fulfillment across Shop, Market, and Staff.
6. Review product B with weak response or displacement. Show an evaluated HOLD and its commitment.
7. Show product C with missing evidence or stale count, then correct the missing operational input explicitly.
8. Advance to the fulfillment boundary. Offer closes in both public views, storefront purchase disables, and terminal chart stops.
9. Reset to reproduce the sequence.

Keep failure demonstrations selectable so the primary walkthrough remains short. Do not simulate sales automatically without identifying the source of those events.

## Priorities if time is limited

Required: branded storefront and market terminal, offer links, new pricing contract, shared state, staff authorization, confirmed publication, mock purchase, cutoff, reset, and core verification.

Next: expanded diagnostics, persistence recovery polish, chart interactions, and presentation animations.

Defer: animated sandwich case, multi-location management, strategy-comparison simulator, real POS/Grubhub, payments, authentication for a live pilot, and claims of measured waste reduction.

## Open implementation questions

- Can the referenced Python engine source be provided for parity testing? Until then, implement from the PDF and label that limitation.
- Which product names, approved images, ingredient/allergen text, and location label should replace synthetic fixtures? Use explicit placeholders meanwhile.
- Are the PDF's one-decision/no-rise rules the final product direction? These plans assume yes; a continuously moving same-stock market would need a different model.
- Where should the demo eventually be hosted? The local build does not depend on that choice.

None of these prevents starting the local shell, contract fixtures, or shared state. Do not fabricate answers as validated campus information.

## Implementation progress — October 25, 2026

The scenario contract and server session/commands are implemented with domain and application tests. The shared flow is reachable at `/shop`, `/market`, `/staff`, and `/offers/:offerId`; `/` retains the existing browser-local website. This is a deliberate routing adaptation to preserve that homepage. HTTP integration verification covers direct route loads, confirmed publication, exact-offer purchase, reservation, fulfillment, and refreshed shared snapshots. The shared flow requires Node and is not part of a static-only deployment.

Next: complete browser acceptance for cross-tab events, reconnect, keyboard use, narrow layouts, and reduced motion, then capture presentation screenshots and finish milestone 5. Do not treat HTTP integration coverage as completed browser verification.

Browser acceptance now covers cross-tab publication/purchase/fulfillment, stale counts, server disconnect/restart recovery, focus retention during editing, skip-link keyboard navigation, and 475px/1280px visual checks. See [the verification record](../verification/browser-acceptance.md) and its screenshots. Live-render focus and draft preservation, mobile connection visibility, and skip navigation were fixed. Remaining: runtime reduced-motion checks, complete keyboard-only/contrast review, cross-browser coverage, and automated browser smoke coverage. Milestone 5 remains in progress.
