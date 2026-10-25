/** @deprecated Legacy continuous stock/time model. Use domain/decide.mjs for MarketBite offers. */
/** All timestamps are UTC epoch milliseconds; all money is integer cents. */
export interface Product {
  id: string;
  name: string;
  ordinaryPriceCents: number;
}

export interface Batch {
  id: string;
  productId: string;
  quantity: number;
  /** Fixed staff-defined stock scale; never automatically adjusted. */
  referenceQuantity: number;
  floorCents: number;
  ceilingCents: number;
  saleStart: number;
  saleCutoff: number;
  approved: boolean;
  paused: boolean;
  ended: boolean;
  lastReconciledAt: number;
}

export interface PricingConfig {
  roundDurationMs: number;
  freshnessMs: number;
  maxDiscountPercent: number;
  crashThresholdPercent: number;
}

export const DEFAULT_CONFIG: PricingConfig = Object.freeze({
  roundDurationMs: 10 * 60_000,
  freshnessMs: 20 * 60_000,
  maxDiscountPercent: 30,
  crashThresholdPercent: 20,
});

export interface PriceRecord {
  version: number;
  priceCents: number;
  timestamp: number;
  explanation: string;
}

export interface PriceChange {
  productId: string;
  batchId: string;
  version: number;
  timestamp: number;
  oldPriceCents: number | null;
  newPriceCents: number;
  quantity: number;
  remainingMs: number;
  formula: { id: "continuous-v1"; referenceQuantity: number; stockPressure: number; windowProgress: number; maxDiscountPercent: number; discountPercent: number };
  bounds: { floorCents: number; approvedCeilingCents: number; ordinaryPriceCents: number; effectiveCeilingCents: number };
  explanation: string;
}

/** Pass the returned state to the next evaluation, including after ineligible results. */
export interface PricingState {
  productId: string;
  batchId: string;
  evaluatedAt: number;
  wasEligible: boolean;
  pricedRound: number | null;
  policyKey: string;
  lastPrice: PriceRecord | null;
}

export type IneligibleReason = "not_started" | "cutoff" | "unapproved" | "paused" | "ended" | "sold_out" | "stale";
export interface ValidationIssue { field: string; code: string; message: string }
export type PricingResult =
  | { ok: false; errors: ValidationIssue[] }
  | { ok: true; eligible: boolean; reason: IneligibleReason | null; priceCents: number | null;
      priceVersion: number | null; nextRoundAt: number | null; explanation: string;
      change: PriceChange | null; triggerCrash: boolean; state: PricingState };

export interface PricingInput {
  now: number;
  product: Product;
  batch: Batch;
  config?: PricingConfig;
  previous?: PricingState;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const validInt = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min;
const validTime = (v: unknown): v is number => validInt(v) && v <= 8_640_000_000_000_000;

/** Accept unknown at the boundary so malformed adapter data produces errors, not crashes. */
export function evaluatePricing(input: unknown): PricingResult {
  const errors: ValidationIssue[] = [];
  const issue = (field: string, code: string, message: string) => { errors.push({ field, code, message }); };
  if (!isObject(input)) return { ok: false, errors: [{ field: "input", code: "required", message: "Expected a pricing input object." }] };
  const integer = (field: string, value: unknown, min = 0) => {
    if (!validInt(value, min)) issue(field, "invalid_integer", `Expected a safe integer of at least ${min}.`);
  };
  const timestamp = (field: string, value: unknown) => {
    if (!validTime(value)) issue(field, "invalid_timestamp", "Expected a nonnegative UTC epoch timestamp in milliseconds.");
  };
  timestamp("now", input.now);
  for (const key of ["product", "batch"] as const) {
    if (!isObject(input[key])) issue(key, "required", `Expected a ${key} object.`);
  }
  if (errors.length) return { ok: false, errors };
  const p = input.product as Record<string, unknown>;
  const b = input.batch as Record<string, unknown>;
  for (const [field, value] of [["product.id", p.id], ["product.name", p.name], ["batch.id", b.id], ["batch.productId", b.productId]]) {
    if (typeof value !== "string" || !value.trim()) issue(field as string, "required", "Expected a nonempty string.");
  }
  integer("product.ordinaryPriceCents", p.ordinaryPriceCents);
  integer("batch.referenceQuantity", b.referenceQuantity, 1);
  for (const key of ["quantity", "floorCents", "ceilingCents"]) integer(`batch.${key}`, b[key]);
  for (const key of ["saleStart", "saleCutoff", "lastReconciledAt"]) timestamp(`batch.${key}`, b[key]);
  for (const key of ["approved", "paused", "ended"]) {
    if (typeof b[key] !== "boolean") issue(`batch.${key}`, "invalid_boolean", "Expected an explicit boolean.");
  }
  if (b.productId !== p.id) issue("batch.productId", "product_mismatch", "Batch must reference this product.");
  if (validInt(b.floorCents) && validInt(b.ceilingCents) && validInt(p.ordinaryPriceCents)
      && b.floorCents > Math.min(b.ceilingCents, p.ordinaryPriceCents)) {
    issue("batch.floorCents", "invalid_bounds", "Floor must not exceed either the approved ceiling or ordinary price.");
  }
  if (validTime(b.saleStart) && validTime(b.saleCutoff) && b.saleStart >= b.saleCutoff) issue("batch.saleCutoff", "invalid_window", "Cutoff must follow sale start.");
  if (validTime(b.lastReconciledAt) && b.lastReconciledAt > (input.now as number)) issue("batch.lastReconciledAt", "future_reconciliation", "Reconciliation cannot be in the future.");

  const c = input.config === undefined ? DEFAULT_CONFIG : input.config;
  if (!isObject(c)) issue("config", "invalid_config", "Expected a complete configuration object.");
  else {
    integer("config.roundDurationMs", c.roundDurationMs, 1);
    integer("config.freshnessMs", c.freshnessMs, 1);
    if (!validInt(c.maxDiscountPercent) || c.maxDiscountPercent > 100) issue("config.maxDiscountPercent", "invalid_discount", "Expected an integer percentage from 0 to 100.");
    if (!validInt(c.crashThresholdPercent, 1) || c.crashThresholdPercent > 100) issue("config.crashThresholdPercent", "invalid_threshold", "Expected an integer percentage from 1 to 100.");
  }

  const prev = input.previous;
  if (prev !== undefined) {
    if (!isObject(prev)) issue("previous", "invalid_state", "Expected state returned by a prior evaluation.");
    else {
      if (prev.productId !== p.id || prev.batchId !== b.id) issue("previous", "state_mismatch", "Previous state belongs to a different product or batch.");
      if (!validTime(prev.evaluatedAt) || prev.evaluatedAt > (input.now as number)) issue("previous.evaluatedAt", "invalid_timestamp", "Evaluation time must not go backwards; discard state when resetting the clock.");
      if (typeof prev.wasEligible !== "boolean" || typeof prev.policyKey !== "string" || !(prev.pricedRound === null || validInt(prev.pricedRound))) issue("previous", "invalid_state", "Previous state has invalid eligibility, policy, or round data.");
      if (prev.lastPrice !== null) {
        const record = prev.lastPrice;
        if (!isObject(record) || !validInt(record.priceCents) || !validInt(record.version, 1) || record.version === Number.MAX_SAFE_INTEGER || !validTime(record.timestamp)
          || record.timestamp > (prev.evaluatedAt as number) || typeof record.explanation !== "string") issue("previous.lastPrice", "invalid_record", "Expected a valid versioned price record.");
      }
      if (prev.wasEligible && (prev.lastPrice === null || prev.pricedRound === null)) issue("previous", "invalid_state", "Eligible state must contain a price and round.");
    }
  }
  if (errors.length) return { ok: false, errors };

  const { now, product, batch, previous } = input as unknown as PricingInput;
  const config = c as unknown as PricingConfig;
  const policyKey = JSON.stringify([product.ordinaryPriceCents, batch.floorCents, batch.ceilingCents,
    batch.saleStart, batch.saleCutoff, config.roundDurationMs, "continuous-v1", config.maxDiscountPercent, batch.referenceQuantity]);
  const baseState: PricingState = {
    productId: product.id, batchId: batch.id, evaluatedAt: now, wasEligible: false,
    pricedRound: previous?.pricedRound ?? null, policyKey,
    lastPrice: previous?.lastPrice ? { ...previous.lastPrice } : null,
  };
  const reason: IneligibleReason | null = now >= batch.saleCutoff ? "cutoff"
    : batch.ended ? "ended" : !batch.approved ? "unapproved" : batch.paused ? "paused"
    : now < batch.saleStart ? "not_started" : batch.quantity === 0 ? "sold_out"
    : now - batch.lastReconciledAt >= config.freshnessMs ? "stale" : null;
  if (reason) {
    const explanations: Record<IneligibleReason, string> = {
      cutoff: "The approved sale cutoff has been reached.", ended: "Staff ended this offer.",
      unapproved: "This batch has not been approved.", paused: "Staff paused this offer.",
      not_started: "The approved sale window has not started.", sold_out: "This batch is sold out.",
      stale: "Inventory needs staff reconciliation before this offer can resume.",
    };
    return { ok: true, eligible: false, reason, priceCents: null, priceVersion: null,
      nextRoundAt: null, explanation: explanations[reason], change: null, triggerCrash: false, state: baseState };
  }

  const round = Math.floor((now - batch.saleStart) / config.roundDurationMs);
  // Avoid overflow near the maximum supported timestamp by comparing intervals first.
  const untilNextRound = config.roundDurationMs - ((now - batch.saleStart) % config.roundDurationMs);
  const nextRoundAt = untilNextRound < batch.saleCutoff - now ? now + untilNextRound : null;
  if (previous?.wasEligible && previous.pricedRound === round && previous.policyKey === policyKey && previous.lastPrice) {
    return { ok: true, eligible: true, reason: null, priceCents: previous.lastPrice.priceCents,
      priceVersion: previous.lastPrice.version, nextRoundAt, explanation: previous.lastPrice.explanation,
      change: null, triggerCrash: false, state: { ...baseState, wasEligible: true } };
  }

  const remainingMs = batch.saleCutoff - now;
  const elapsedMs = now - batch.saleStart;
  const windowMs = batch.saleCutoff - batch.saleStart;
  const cappedQuantity = Math.min(batch.quantity, batch.referenceQuantity);
  const stockPressure = cappedQuantity / batch.referenceQuantity;
  const windowProgress = elapsedMs / windowMs;
  const discountPercent = config.maxDiscountPercent * stockPressure * windowProgress;
  const ceiling = Math.min(batch.ceilingCents, product.ordinaryPriceCents);
  // Exact rational calculation: never use rounded display percentages for money.
  const denominator = 100n * BigInt(batch.referenceQuantity) * BigInt(windowMs);
  const discountNumerator = BigInt(config.maxDiscountPercent) * BigInt(cappedQuantity) * BigInt(elapsedMs);
  const numerator = BigInt(product.ordinaryPriceCents) * (denominator - discountNumerator);
  const discounted = Number((2n * numerator + denominator) / (2n * denominator));
  const priceCents = Math.max(batch.floorCents, Math.min(ceiling, discounted));
  const formatPercent = (value: number) => Number(value.toFixed(2)).toString();
  const progressText = elapsedMs * 2 === windowMs ? "halfway through" : `approximately ${formatPercent(windowProgress * 100)}% through`;
  const explanation = `${batch.quantity} units remain against a reference of ${batch.referenceQuantity}, ${progressText} the sale window: approximately ${formatPercent(discountPercent)}% calculated discount.`
    + (priceCents !== discounted ? ` Adjusted to approved price bounds (${batch.floorCents}–${ceiling} cents).` : "");
  const old = previous?.lastPrice ?? null;
  const changed = old === null || old.priceCents !== priceCents;
  const version = old === null ? 1 : old.version + (changed ? 1 : 0);
  const lastPrice: PriceRecord = { version, priceCents, timestamp: changed ? now : old!.timestamp, explanation };
  const change: PriceChange | null = changed ? {
    productId: product.id, batchId: batch.id, version, timestamp: now,
    oldPriceCents: old?.priceCents ?? null, newPriceCents: priceCents, quantity: batch.quantity, remainingMs,
    formula: { id: "continuous-v1", referenceQuantity: batch.referenceQuantity, stockPressure, windowProgress, maxDiscountPercent: config.maxDiscountPercent, discountPercent },
    bounds: { floorCents: batch.floorCents, approvedCeilingCents: batch.ceilingCents, ordinaryPriceCents: product.ordinaryPriceCents, effectiveCeilingCents: ceiling }, explanation,
  } : null;
  const triggerCrash = changed && old !== null && old.priceCents > 0 && priceCents < old.priceCents
    && BigInt(old.priceCents - priceCents) * 100n >= BigInt(old.priceCents) * BigInt(config.crashThresholdPercent);
  return { ok: true, eligible: true, reason: null, priceCents, priceVersion: version, nextRoundAt,
    explanation, change, triggerCrash, state: { ...baseState, wasEligible: true, pricedRound: round, lastPrice } };
}
