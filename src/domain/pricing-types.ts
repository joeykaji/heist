/** Decimal strings retain input precision. Numbers are accepted for existing UI callers. */
export type DecimalInput = string | number;
export interface PricingBatch {
  label: string;
  original_cents: number;
  current_cents: number;
  physical_units: number;
  reserved_units: number;
  protected_units: number;
  buffer_units: number;
  fee_fraction?: DecimalInput | null;
  sale_cost_cents?: number | null;
  order_fee_cents?: number | null;
  activation_cents?: number | null;
  min_unit_contribution_cents?: number;
  merchant_floor_cents?: number;
  minutes_to_cutoff?: number;
  fulfillment_buffer_minutes?: DecimalInput;
  count_age_minutes?: DecimalInput;
  capacity_units?: number | null;
  safe_and_approved?: boolean;
  checkout_supported?: boolean;
  surplus_eligible?: boolean;
  demand_reviewed?: boolean;
  economics_reviewed?: boolean;
  markdowns_used?: number;
  window_committed?: boolean;
}
export interface PricingScenario {
  label: string;
  weight: DecimalInput;
  demand?: Record<number, number> | null;
  orders?: Record<number, number> | null;
  terminal_value_cents?: DecimalInput | null;
  other_loss_cents?: Record<number, DecimalInput> | null;
  capacity_units?: number | null;
}
export interface PricingPolicy {
  discounts: readonly DecimalInput[];
  max_discount: DecimalInput;
  window_minutes: DecimalInput;
  min_gain_cents: DecimalInput;
  downside_budget_cents: DecimalInput;
  min_incremental_sales: DecimalInput;
  max_markdowns: 0 | 1;
  max_count_age_minutes: DecimalInput;
}
/** Exact rational audit values: JSON-safe strings, no rounded selection arithmetic. */
export interface ExactValue { numerator: string; denominator: string }
export interface CandidateDiagnostics {
  price_cents: number;
  scenario_sales: number[];
  scenario_values_cents: number[];
  scenario_gains_cents: number[];
  expected_sales: number;
  expected_value_cents: number;
  expected_gain_cents: number;
  worst_gain_cents: number;
  sales_uplift: number;
  admissible: boolean;
  gates: Record<'lower_price' | 'baseline_leftovers' | 'sales_uplift' | 'positive_gain' | 'minimum_gain' | 'downside', boolean>;
  exact: {
    expected_sales: ExactValue;
    expected_value_cents: ExactValue;
    expected_gain_cents: ExactValue;
    worst_gain_cents: ExactValue;
    sales_uplift: ExactValue;
    scenario_values_cents: ExactValue[];
    scenario_gains_cents: ExactValue[];
  };
}
interface DecisionBase {
  label: string;
  reason: string;
  available: number;
  floor_cents: number | null;
  missing_inputs: string[];
}
export type PricingDecision = DecisionBase & (
  | { status: 'PAUSE' | 'REVIEW'; price_cents: null; evaluation_completed: false; expected_gain_cents: null; worst_gain_cents: null; rows: [] }
  | { status: 'HOLD'; price_cents: number; evaluation_completed: false; expected_gain_cents: null; worst_gain_cents: null; rows: [] }
  | { status: 'HOLD' | 'MARKDOWN'; price_cents: number; evaluation_completed: true; expected_gain_cents: number; worst_gain_cents: number; rows: CandidateDiagnostics[]; normalized_weights: number[]; baseline_sales: number; baseline_value_cents: number; expected_baseline_leftovers: number; selected_sales: number; exact: { normalized_weights: ExactValue[]; expected_gain_cents: ExactValue; worst_gain_cents: ExactValue } }
);
