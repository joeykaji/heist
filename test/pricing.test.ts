import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePricing, DEFAULT_CONFIG, type PricingInput, type PricingResult } from "../src/pricing.js";

const MIN = 60_000;
const START = Date.parse("2026-10-20T18:00:00Z");
function fixture(quantity = 12, minutesLeft = 90): PricingInput {
  return { now: START, product: { id: "sandwich", name: "Simulated sandwich", ordinaryPriceCents: 1000 },
    batch: { id: "batch", productId: "sandwich", quantity, referenceQuantity: 12, floorCents: 100, ceilingCents: 1000,
      saleStart: START, saleCutoff: START + minutesLeft * MIN, approved: true, paused: false, ended: false, lastReconciledAt: START } };
}
function evaluate(input: unknown) {
  const result = evaluatePricing(input);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error("Unreachable");
  return result;
}
function invalid(input: unknown, field: string) {
  const result = evaluatePricing(input);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected validation failure");
  assert.ok(result.errors.some(error => error.field === field), JSON.stringify(result.errors));
}
function advance(input: PricingInput, previous: Extract<PricingResult, { ok: true }>, minutes: number): PricingInput {
  const now = input.now + minutes * MIN;
  return { ...input, now, batch: { ...input.batch, lastReconciledAt: now }, previous: previous.state };
}

test("continuous formula at start, midpoint, near cutoff, and stock saturation", () => {
  for (const [quantity, elapsed, expected] of [[12, 0, 1000], [12, 45, 850], [6, 45, 925], [24, 45, 850], [12, 90 - 1 / MIN, 700]]) {
    const input = fixture(quantity!, 90);
    input.now = START + elapsed! * MIN;
    input.batch.lastReconciledAt = input.now;
    assert.equal(evaluate(input).priceCents, expected);
  }
});

test("round half cents upward, preserve large amounts, and enforce bounds", () => {
  const input = fixture(12, 60);
  input.now += 30 * MIN;
  input.batch.lastReconciledAt = input.now;
  input.product.ordinaryPriceCents = 1010;
  input.batch.ceilingCents = 2000;
  assert.equal(evaluate(input).priceCents, 859); // 858.5 cents
  input.batch.floorCents = 900;
  const bounded = evaluate(input);
  assert.equal(bounded.priceCents, 900);
  assert.match(bounded.explanation, /Adjusted to approved price bounds/);
  input.batch.floorCents = 100;
  input.batch.ceilingCents = 600;
  assert.equal(evaluate(input).priceCents, 600);
  input.batch.ceilingCents = Number.MAX_SAFE_INTEGER;
  input.product.ordinaryPriceCents = Number.MAX_SAFE_INTEGER;
  input.batch.referenceQuantity = Number.MAX_SAFE_INTEGER;
  input.batch.quantity = Number.MAX_SAFE_INTEGER;
  assert.equal(evaluate(input).priceCents, 7656119366529842);
  input.now = START;
  input.batch.lastReconciledAt = START;
  assert.equal(evaluate(input).priceCents, Number.MAX_SAFE_INTEGER);
  input.product.ordinaryPriceCents = 1000;
  input.config = { ...DEFAULT_CONFIG, maxDiscountPercent: 0 };
  assert.equal(evaluate(input).priceCents, 1000);
});

test("first eligibility, aligned rounds, retention, recovery and skipped rounds", () => {
  let input = fixture(12, 120);
  input.now += 3 * MIN;
  let result = evaluate(input);
  assert.equal(result.priceCents, 993);
  assert.equal(result.priceVersion, 1);
  assert.equal(result.change?.oldPriceCents, null);
  assert.equal(result.nextRoundAt, START + 10 * MIN);
  input = advance(input, result, 6);
  input.batch.quantity = 1;
  result = evaluate(input);
  assert.equal(result.priceCents, 993);
  assert.equal(result.change, null);
  input = advance(input, result, 1);
  result = evaluate(input);
  assert.equal(result.priceCents, 998);
  assert.equal(result.priceVersion, 2);
  assert.equal(result.triggerCrash, false);
  input = advance(input, result, 90);
  result = evaluate(input);
  assert.equal(result.priceCents, 979);
  assert.equal(result.priceVersion, 3);
  assert.equal(result.state.pricedRound, 10);
});

test("unchanged rounds preserve version and change timestamp", () => {
  const input = fixture();
  input.config = { ...DEFAULT_CONFIG, maxDiscountPercent: 0 };
  const first = evaluate(input);
  const second = evaluate(advance(input, first, 10));
  assert.equal(second.priceVersion, first.priceVersion);
  assert.equal(second.state.lastPrice?.timestamp, first.state.lastPrice?.timestamp);
  assert.equal(second.change, null);
});

test("eligibility always checked, independent of rounds", () => {
  const cases: [string, (input: PricingInput) => void][] = [
    ["not_started", input => { input.batch.saleStart += 1; }],
    ["cutoff", input => { input.now = input.batch.saleCutoff; input.batch.lastReconciledAt = input.now; }],
    ["unapproved", input => { input.batch.approved = false; }],
    ["paused", input => { input.batch.paused = true; }],
    ["ended", input => { input.batch.ended = true; }],
    ["sold_out", input => { input.batch.quantity = 0; }],
    ["stale", input => { input.batch.lastReconciledAt -= 20 * MIN; }],
  ];
  for (const [reason, mutate] of cases) {
    const input = fixture();
    input.previous = evaluate(input).state;
    mutate(input);
    const result = evaluate(input);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, reason);
    assert.equal(result.priceCents, null);
    assert.equal(result.priceVersion, null);
    assert.equal(result.nextRoundAt, null);
    assert.equal(result.change, null);
    assert.equal(result.triggerCrash, false);
  }
  const fresh = fixture();
  fresh.batch.lastReconciledAt -= 20 * MIN - 1;
  assert.equal(evaluate(fresh).eligible, true);
});

test("cutoff is exclusive and no round is scheduled at or past it", () => {
  const input = fixture(1, 5);
  assert.equal(evaluate(input).eligible, true);
  assert.equal(evaluate(input).nextRoundAt, null);
  input.now = input.batch.saleCutoff - 1;
  assert.equal(evaluate(input).eligible, true);
  input.now += 1;
  assert.equal(evaluate(input).reason, "cutoff");
});

test("resuming within the same round recalculates immediately", () => {
  const input = fixture();
  input.now += 45 * MIN;
  input.batch.lastReconciledAt = input.now;
  const first = evaluate(input);
  input.previous = first.state;
  input.batch.paused = true;
  const paused = evaluate(input);
  assert.deepEqual(paused.state.lastPrice, first.state.lastPrice);
  input.previous = paused.state;
  input.batch.paused = false;
  input.batch.quantity = 1;
  const resumed = evaluate(input);
  assert.equal(resumed.priceCents, 988);
  assert.equal(resumed.priceVersion, 2);
});

test("crash signals require a markdown, trigger at the threshold, and do not repeat", () => {
  const input = fixture(1, 60);
  const first = evaluate(input);
  assert.equal(first.triggerCrash, false);
  const next = advance(input, first, 40);
  next.batch.quantity = 12;
  const crash = evaluate(next);
  assert.equal(crash.priceCents, 800);
  assert.equal(crash.triggerCrash, true);
  assert.equal(evaluate({ ...next, previous: crash.state }).triggerCrash, false);
  assert.equal(evaluate({ ...next, config: { ...DEFAULT_CONFIG, crashThresholdPercent: 21 } }).triggerCrash, false);
  assert.equal(evaluate(advance(next, crash, 10)).triggerCrash, false);
});

test("change records explain their full formula inputs", () => {
  const input = fixture(6, 60);
  input.now += 30 * MIN;
  input.batch.lastReconciledAt = input.now;
  const result = evaluate(input);
  assert.deepEqual(result.change, {
    productId: "sandwich", batchId: "batch", version: 1, timestamp: input.now,
    oldPriceCents: null, newPriceCents: 925, quantity: 6, remainingMs: 30 * MIN,
    formula: { id: "continuous-v1", referenceQuantity: 12, stockPressure: 0.5, windowProgress: 0.5, maxDiscountPercent: 30, discountPercent: 7.5 },
    bounds: { floorCents: 100, approvedCeilingCents: 1000, ordinaryPriceCents: 1000, effectiveCeilingCents: 1000 },
    explanation: "6 units remain against a reference of 12, halfway through the sale window: approximately 7.5% calculated discount.",
  });
});

test("formula settings, reference quantity and bounds apply immediately", () => {
  const input = fixture(12, 60);
  input.now += 30 * MIN;
  input.batch.lastReconciledAt = input.now;
  input.previous = evaluate(input).state;
  input.batch.floorCents = 950;
  assert.equal(evaluate(input).priceCents, 950);
  input.batch.floorCents = 100;
  input.batch.referenceQuantity = 24;
  assert.equal(evaluate(input).priceCents, 925);
  input.batch.referenceQuantity = 12;
  input.config = { ...DEFAULT_CONFIG, maxDiscountPercent: 60, roundDurationMs: 5 * MIN };
  const result = evaluate(input);
  assert.equal(result.priceCents, 700);
  assert.equal(result.nextRoundAt, START + 35 * MIN);
  assert.equal(result.priceVersion, 2);
  assert.equal(evaluate({ ...input, previous: result.state }).change, null);
});

test("structured errors cover missing, fractional, negative, and inverted inputs", () => {
  invalid(null, "input");
  invalid({}, "now");
  invalid({ now: START }, "product");
  for (const value of [undefined, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "100"]) {
    const input = fixture();
    invalid({ ...input, product: { ...input.product, ordinaryPriceCents: value } }, "product.ordinaryPriceCents");
    for (const key of ["floorCents", "ceilingCents", "quantity"]) invalid({ ...input, batch: { ...input.batch, [key]: value } }, `batch.${key}`);
  }
  const input = fixture();
  input.batch.floorCents = 1001;
  invalid(input, "batch.floorCents");
  input.batch.floorCents = 500;
  input.batch.ceilingCents = 499;
  invalid(input, "batch.floorCents");
  for (const value of [START, START - 1, "tomorrow", NaN, 8_640_000_000_000_001]) invalid({ ...fixture(), batch: { ...fixture().batch, saleCutoff: value } }, "batch.saleCutoff");
  invalid({ ...fixture(), batch: { ...fixture().batch, lastReconciledAt: START + 1 } }, "batch.lastReconciledAt");
  invalid({ ...fixture(), batch: { ...fixture().batch, approved: undefined } }, "batch.approved");
  invalid({ ...fixture(), batch: { ...fixture().batch, productId: "other" } }, "batch.productId");
});

test("malformed configuration and previous state are rejected", () => {
  for (const config of [null, {}, { ...DEFAULT_CONFIG, roundDurationMs: 0 }, { ...DEFAULT_CONFIG, maxDiscountPercent: -1 },
    { ...DEFAULT_CONFIG, maxDiscountPercent: 101 }, { ...DEFAULT_CONFIG, maxDiscountPercent: 1.5 }, { ...DEFAULT_CONFIG, crashThresholdPercent: 101 }]) {
    const result = evaluatePricing({ ...fixture(), config });
    assert.equal(result.ok, false);
  }
  const input = fixture();
  const previous = evaluate(input).state;
  invalid({ ...input, previous: { ...previous, batchId: "other" } }, "previous");
  invalid({ ...input, previous: { ...previous, evaluatedAt: START + 1 } }, "previous.evaluatedAt");
  invalid({ ...input, previous: { ...previous, lastPrice: {} } }, "previous.lastPrice");
});

test("deterministic results do not mutate input, inventory, or reconciliation", () => {
  const input = fixture();
  const saved = structuredClone(input);
  Object.freeze(input.product);
  Object.freeze(input.batch);
  Object.freeze(input);
  assert.deepEqual(evaluate(input), evaluate(input));
  assert.deepEqual(input, saved);
  const first = evaluate(input);
  const savedState = structuredClone(first.state);
  evaluate({ ...input, now: START + 10 * MIN, previous: first.state });
  assert.deepEqual(first.state, savedState);
  assert.equal(evaluate({ ...input, now: START + 20 * MIN, previous: first.state }).reason, "stale");
});

test("fresh reconciliation resumes stale offers immediately without resetting rounds", () => {
  const input = fixture();
  input.batch.lastReconciledAt = START - 19 * MIN;
  const first = evaluate(input);
  input.now += MIN;
  input.previous = first.state;
  const stale = evaluate(input);
  assert.equal(stale.reason, "stale");
  input.previous = stale.state;
  input.batch.lastReconciledAt = input.now;
  input.batch.quantity = 1;
  const resumed = evaluate(input);
  assert.equal(resumed.priceCents, 1000);
  assert.equal(resumed.nextRoundAt, START + 10 * MIN);
});

test("zero prices and maximum discounts are valid", () => {
  const input = fixture();
  input.product.ordinaryPriceCents = 0;
  input.batch.floorCents = 0;
  const first = evaluate(input);
  assert.equal(first.priceCents, 0);
  assert.equal(evaluate(advance(input, first, 10)).triggerCrash, false);
  input.product.ordinaryPriceCents = 1000;
  input.config = { ...DEFAULT_CONFIG, maxDiscountPercent: 100 };
  assert.equal(evaluate(input).priceCents, 1000);
  input.now += 45 * MIN;
  input.batch.lastReconciledAt = input.now;
  assert.equal(evaluate(input).priceCents, 500);
  input.now = input.batch.saleCutoff - 1;
  input.batch.lastReconciledAt = input.now;
  assert.equal(evaluate(input).priceCents, 0);
  input.now += 1;
  assert.equal(evaluate(input).priceCents, null);
});

test("markdowns below the configured crash percentage do not trigger animation", () => {
  const input = fixture(1, 90);
  const first = evaluate(input);
  const next = advance(input, first, 30);
  next.batch.quantity = 12;
  assert.equal(evaluate(next).priceCents, 900);
  assert.equal(evaluate(next).triggerCrash, false);
  next.config = { ...DEFAULT_CONFIG, crashThresholdPercent: 10 };
  assert.equal(evaluate(next).triggerCrash, true);
});

test("invalid references and maximum discounts return structured errors", () => {
  const input = fixture();
  for (const value of [undefined, null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "12"]) {
    invalid({ ...input, batch: { ...input.batch, referenceQuantity: value } }, "batch.referenceQuantity");
  }
  for (const value of [undefined, null, -1, 101, 1.5, NaN, Infinity, "30"]) {
    invalid({ ...input, config: { ...DEFAULT_CONFIG, maxDiscountPercent: value } }, "config.maxDiscountPercent");
  }
});

test("prices are monotonic in time and stock, including clamps and rounding plateaus", () => {
  for (const [floor, ceiling] of [[0, 1000], [900, 950]]) {
    for (const quantity of [1, 6, 12, 24]) {
      let previousPrice = Infinity;
      for (let elapsed = 0; elapsed < 90; elapsed++) {
        const input = fixture(quantity, 90);
        input.now += elapsed * MIN;
        input.batch.lastReconciledAt = input.now;
        input.batch.floorCents = floor!;
        input.batch.ceilingCents = ceiling!;
        const price = evaluate(input).priceCents!;
        assert.ok(price <= previousPrice);
        assert.ok(price >= floor! && price <= ceiling!);
        previousPrice = price;
      }
    }
    for (const elapsed of [0, 15, 45, 89]) {
      let previousPrice = Infinity;
      for (let quantity = 1; quantity <= 30; quantity++) {
        const input = fixture(quantity, 90);
        input.now += elapsed * MIN;
        input.batch.lastReconciledAt = input.now;
        input.batch.floorCents = floor!;
        input.batch.ceilingCents = ceiling!;
        const price = evaluate(input).priceCents!;
        assert.ok(price <= previousPrice);
        previousPrice = price;
      }
    }
  }
});

test("display rounding does not control monetary rounding", () => {
  const input = fixture(1, 60);
  input.batch.referenceQuantity = 7;
  input.product.ordinaryPriceCents = 1_000_000;
  input.batch.ceilingCents = 1_000_000;
  input.now += 30 * MIN;
  input.batch.lastReconciledAt = input.now;
  const result = evaluate(input);
  assert.match(result.explanation, /2.14% calculated discount/);
  assert.equal(result.priceCents, 978571);
});
