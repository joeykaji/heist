import type {PricingBatch, PricingScenario, PricingPolicy, PricingDecision} from './pricing-types.js';
export const DEFAULT_POLICY: Readonly<PricingPolicy>;
/** Throws on malformed supplied input; missing reviewed evidence returns REVIEW. */
export function decide(batch: PricingBatch, scenarios?: PricingScenario[], policy?: Partial<PricingPolicy>): PricingDecision;
export function candidatePrices(batch: PricingBatch, policy?: Partial<PricingPolicy>): {floor: number | null; prices: number[]};
