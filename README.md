# Campus Food Exchange — pricing engine

A deterministic, simulated pricing module for section 3 of `plan.md`. Inventory, prices, and demo results are illustrative; they are not validated dining policy. There are no screens, real orders, payments, persistence, or integrations.

## Run

Use Node.js 22 or later and npm:

```sh
npm ci
npm test
npm run demo
```

`npm run build` compiles TypeScript and emits declarations into `dist/`. Tests use Node's built-in runner against compiled code. The three-product demo resets on each run and uses explicit simulated times, showing markdowns, recovery, pause/resume, and cutoffs. Reconciliation in the demo is an explicit scenario action, never a side effect of pricing.

## Integrate

Import `evaluatePricing` and the exported types from `src/pricing.ts` (or `dist/src/pricing.js` after building). Supply `now`, `product`, `batch`, an optional complete `config`, and the `previous` state returned by the last successful call. `PricingInput` describes the input; the function accepts unknown data so adapters receive structured validation errors for malformed input.

```ts
const result = evaluatePricing({ now, product, batch, previous });
if (!result.ok) {
  // Surface result.errors; do not offer a cached price.
} else {
  previous = result.state; // Save even when ineligible.
  // Only result.eligible authorizes showing result.priceCents as purchasable.
  // Append result.change to the audit log when non-null.
}
```

State includes the previous price record, evaluated round, policy identity, and eligibility. A price record alone cannot detect a pause followed by resumption in the same round. The authoritative service must evaluate status transitions and preserve returned state, including ineligible decisions. If a pause and resume both occur between evaluations, the engine cannot infer them. Discard state on a simulated clock reset or new batch; time cannot move backwards with retained state. Treat previous state as service-owned, not client-controlled.

All money uses nonnegative integer cents. Times use nonnegative UTC epoch milliseconds; use `America/New_York` for future campus display formatting. Sale start is inclusive and cutoff exclusive. Missing required fields fail validation; approval, pause, and end flags must be explicit booleans. Zero price is valid when staff bounds permit it.

## Pricing rules

| Stock | More than 60 minutes left | More than 30, through 60 minutes | 30 minutes or less |
|---|---:|---:|---:|
| 1–5 | 0% | 0% | 10% |
| 6–10 | 0% | 10% | 20% |
| 11+ | 10% | 20% | 30% |

Discounts apply to ordinary price, round half cents upward, and are clamped to the approved floor and the lower of approved ceiling or ordinary price. A floor above that effective ceiling is invalid. Tiers use exact remaining milliseconds; explanation text rounds remaining minutes upward. Thresholds, discount percentages, round duration, freshness duration, and crash threshold are configurable through `PricingConfig`; defaults are exported as `DEFAULT_CONFIG`.

Ten-minute rounds align to sale start. The first eligible evaluation prices immediately. Within a round, quantity changes retain the established price unless they make the offer ineligible. Later rounds may reduce or recover the price. Skipped rounds calculate only the current decision. Policy changes (ordinary price, bounds, sale window, round duration, tiers) apply immediately so old prices cannot violate new approvals. Resuming from any observed ineligible state also recalculates immediately.

Versions begin at 1 and increment only when the monetary price changes. Initial pricing emits a change record with a null old price. Unchanged prices emit no change record; a newly evaluated round may refresh its explanation without changing version or price-change timestamp. A crash signal requires an actual decrease of at least 20% from the previous price, is configurable, and never occurs on initial pricing. Consume the signal once while saving the returned state; retrying the same input deliberately returns the same result. Deduplicate downstream animation/audit delivery by batch and price version.

## Eligibility and service responsibilities

Every evaluation checks cutoff, ended, approval, pause, sale start, stock, then freshness, in that priority order. Inventory is stale at 20 minutes since reconciliation. Price calculations never refresh that timestamp or change stock. Ineligible results return null price, version, and next round; historical state is retained only for continuity and is not an offer.

`nextRoundAt` is the next pricing round strictly before cutoff, or null when none remains. It is not an eligibility expiry or a timer for all state changes. The service must also schedule checks for sale start, freshness expiry, and cutoff, and evaluate staff/inventory changes immediately. Check eligibility again at order acceptance; cached prices, quotes, and animation state cannot bypass cutoff. This engine does not implement stock reservation, order acceptance, synchronization, or checkout atomicity.

The future authoritative application service owns scheduling, serialized evaluation/state updates per batch, persistence, inventory events, and audit logs. Persist the returned state and change together. Invalid inputs should stop offer publication until corrected. Recheck current configuration and inventory rather than trusting client-provided state.
