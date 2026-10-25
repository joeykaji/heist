// Synthetic arithmetic fixture, not measured cafe economics or calibrated demand.
// Baseline: 1*600=600. At 330: 4*330=1320, gain=720, uplift=3.
export const batch = () => ({ label: 'Synthetic sandwich batch', original_cents: 600, current_cents: 600, physical_units: 10, reserved_units: 0, protected_units: 0, buffer_units: 0, fee_fraction: '0', sale_cost_cents: 0, order_fee_cents: 0, activation_cents: 0, minutes_to_cutoff: 60, safe_and_approved: true, checkout_supported: true, surplus_eligible: true, demand_reviewed: true, economics_reviewed: true });
export const scenario = () => ({ label: 'Synthetic reviewed assumption', weight: '1', demand: { 600: 1, 510: 2, 420: 3, 330: 4 }, terminal_value_cents: '0', other_loss_cents: { 600: '0', 510: '0', 420: '0', 330: '0' } });
