# Pricing migration

## Contract change

The existing `evaluatePricing` engine is not the model in the supplied PDF. Preserve it temporarily as a legacy module and keep its tests passing during migration. Add a separate scenario-decision module with explicit types; switch the app to it only after contract tests pass. Remove legacy behavior from the active demo and update README/CLI documentation at cutover.

Do not adapt the old formula by adding a few flags: its recurring markdowns, recovery, maximum discount, timing, and input assumptions differ fundamentally.

## Proposed modules

- `src/domain/pricing-types.ts`: batch, reviewed scenarios, policy, diagnostics, and result types.
- `src/domain/decimal.ts`: exact decimal parsing and arithmetic conventions.
- `src/domain/decide.ts`: pure decision function; no persistence or checkout mutations.
- `test/decision.test.ts`: mathematical and status contract tests.
- `test/fixtures/`: reviewed synthetic scenarios and independently calculated expected results.

Use integer cents for prices and monetary inputs. Use exact decimal/rational arithmetic for rates, weights, and expectations; do not select candidates with binary floating-point rounding. Choose and document a decimal library or rational representation before coding. Serialize decimals as strings at the API boundary.

## Inputs

Batch inputs must represent physical units, accepted-order reservations, protected allocations, stock buffer, genuine regular price, checkout-confirmed price, fees, incremental sale costs, minimum contribution, merchant floor, activation cost, approved timing, count age, optional capacity, explicit approval/review flags, markdown count, and commitment state.

Each reviewed scenario supplies a positive weight, demand at every feasible candidate, terminal value, outside-batch loss at every candidate, optional capacity, and billable order counts when the fixed-order fee is positive. Missing economic evidence requires REVIEW; explicit reviewed zero is different from missing.

Do not guess demand curves or force monotonicity. Seeded demo assumptions must be visibly synthetic and include weak-response, outside-displacement, and capacity-limited examples.

## Calculation checklist

1. Validate batch/policy inputs. Counts are nonnegative integers; allocations cannot exceed physical stock. Validate current/regular prices, rates, discounts, limits, and flags using the PDF contract.
2. Compute offer units `Q = physical - reserved - protected - buffer`.
3. Compute the binding cent-ceiling floor as the maximum of one cent, merchant floor, maximum-discount floor, and `(sale cost + fixed order fee + minimum unit contribution) / (1 - fee fraction)`.
4. Apply ordered PAUSE and administrative HOLD conditions. Time eligibility is strictly `fulfillment buffer < remaining minutes <= review window`.
5. Return REVIEW for missing or unreviewed required evidence, with field-level missing-input details.
6. Build unique cent-ceiling ladder prices plus current price, restricted to the floor/current-price interval. If current price is below a known floor, PAUSE; never increase it.
7. Validate complete scenarios for feasible candidates. Accept weight-sum error at most `1e-9` and normalize accepted weights.
8. Cap fulfilled sales within each scenario by offer units and each supplied capacity before averaging.
9. Compute scenario contribution: net unit contribution times fulfilled units, minus actual fixed order fees, plus terminal value of leftovers, minus activation once for a lower price, minus outside-batch loss.
10. Compute gains relative to current price inside each scenario; aggregate expected gain, worst listed gain, expected baseline leftovers, and sales uplift.
11. Accept a markdown only with positive baseline leftovers, uplift strictly above threshold, expected gain strictly positive and at least the minimum, and worst gain at least negative downside allowance.
12. Select maximum unrounded expected gain; exact ties select the higher price. Otherwise return a completed HOLD.

## Defaults from the reference

| Parameter | Value |
|---|---|
| Ladder | 0%, 15%, 30%, 45% |
| Maximum discount | 45% |
| Minimum expected gain | 50 cents/window |
| Downside allowance | 0 cents/window |
| Sales-uplift threshold | 0 units, strict |
| Review window | 120 minutes |
| Fulfillment buffer | 5 minutes |
| Maximum count age | 30 minutes |
| Committed decisions / markdowns | At most 1 / 1 |

These settings are configurable assumptions, not empirically optimal values.

## Result semantics

- ERROR: malformed input; reject with structured validation details at the application boundary.
- PAUSE: unavailable operation or safety/stock/timing condition; no new price.
- REVIEW: missing/unreviewed economics or demand; no new price or fabricated zero forecasts.
- Administrative HOLD: no completed comparison and no new commitment.
- Evaluated HOLD: keep confirmed price and commit the window decision.
- MARKDOWN: recommendation only; publish after authorized checkout acknowledgment.

Every result retains reason, available units, known floor, completion status, missing inputs, and candidate diagnostics. Keep absence distinct from numeric zero. The application derives purchasable availability from current operational state and confirmed checkout state, not from a decision status alone.

## Required verification

- Cent-ceiling rounding, floor binding, rounded-price deduplication, and current-price-below-floor pause.
- Protected/reserved/buffer allocation validation and zero offer inventory.
- Missing versus explicit-zero economics, reviewed flags, order-count completeness, signed terminal values, and baseline outside loss exactly zero.
- Exact weight tolerance/normalization, cap-before-average, activation charged once, no duplicate same-batch displacement cost.
- Strict uplift/positive-gain boundaries; inclusive minimum gain and downside boundaries; exact tie-breaking.
- Ordered pause/hold/review rules, time boundaries, inventory age boundary, disabled markdown policy, prior commitment, and markdown limit.
- One completed decision per batch/window; no same-batch upward publication; accepted order prices remain unchanged.
- Invalid scenario data is rejected at comparison rather than bypassing earlier administrative rules.

Use hand-calculated fixtures for core economics and invariant/property tests for broader coverage. Existing legacy tests cannot substitute for these.

## Shared display contract

The storefront and market terminal consume the same confirmed offer projection. Neither calls the decision engine to derive a display price. A single acknowledged price event updates both; pending recommendations remain staff-only. Chart points, ticker values, card prices, and purchase versions must originate from that same event history. Storefront savings and terminal percentage changes use the same cent-based formatting/calculation helpers.

## Cutover

Update seeded CLI demo, documentation, UI terminology, and service scheduling together. Ten-minute repricing and crash-threshold configuration must disappear from the active path. Continue operational monitoring after commitment; do not run automatic reoptimization. Do not claim parity with the absent Python reference until its behavior can be compared.

## Migration implementation status

Implemented on the Website branch: canonical `src/domain/decide.mjs`, exact rational `decimal.mjs`, TypeScript contracts, generated browser-compatible engine, source contract tests, and the active scenario CLI. The existing browser adapter continues to consume `dist/pricing.mjs`; its integration tests exercise authorization, acknowledgment, commitment, inventory, and publication. Legacy TypeScript pricing/demo remain isolated behind explicit legacy scripts. The module uses JavaScript ESM plus TypeScript declarations to fit this branch's existing static ESM application rather than introducing a second runtime engine.

The planned authoritative server/session architecture remains separate work; this engine migration does not replace the current browser-local adapter or claim parity with the unavailable Python reference.
