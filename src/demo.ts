// LEGACY demo only. The active scenario-contract CLI is src/demo.mjs (npm run demo).
import { evaluatePricing, type Product, type Batch, type PricingState } from "./pricing.js";

const MIN = 60_000;
const start = Date.parse("2026-10-20T18:00:00Z");
const products: Product[] = [
  { id: "turkey", name: "Turkey sandwich", ordinaryPriceCents: 1000 },
  { id: "veggie", name: "Vegetable sandwich", ordinaryPriceCents: 800 },
  { id: "cheese", name: "Cheese sandwich", ordinaryPriceCents: 600 },
];
const batches: Batch[] = products.map((product, index) => ({
  id: `${product.id}-demo`, productId: product.id, quantity: [12, 6, 3][index]!,
  referenceQuantity: [12, 6, 3][index]!,
  floorCents: 200, ceilingCents: product.ordinaryPriceCents,
  saleStart: start, saleCutoff: start + [70, 60, 45][index]! * MIN,
  approved: true, paused: false, ended: false, lastReconciledAt: start,
}));
const states = new Map<string, PricingState>();
function show(minutes: number, label: string) {
  const now = start + minutes * MIN;
  console.log(`\nSIMULATED — ${label} — ${new Date(now).toISOString()}`);
  for (const [index, product] of products.entries()) {
    const batch = batches[index]!;
    const previous = states.get(batch.id);
    const result = evaluatePricing({ now, product, batch, ...(previous ? { previous } : {}) });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    states.set(batch.id, result.state);
    console.log(`${product.name}: ${result.eligible ? `$${(result.priceCents! / 100).toFixed(2)} (v${result.priceVersion})` : result.reason}${result.triggerCrash ? " [crash animation signal]" : ""} — ${result.explanation}`);
  }
}
function reconcile(minutes: number) {
  // This scenario action simulates staff recounting; the pricing engine never does it.
  for (const batch of batches) batch.lastReconciledAt = start + minutes * MIN;
}
console.log("SIMULATION ONLY: illustrative inventory and prices, no real sales or dining policy.");
show(0, "Opening offers");
reconcile(10);
show(10, "Round markdown");
batches[1]!.paused = true;
show(11, "Staff pauses vegetable offer");
batches[1]!.quantity = 2;
batches[1]!.paused = false;
show(12, "Staff resumes after simulated stock correction; immediate recovery");
batches[0]!.quantity = 2;
reconcile(20);
show(20, "Turkey price recovers as tracked surplus falls");
reconcile(40);
show(40, "Near-cutoff pricing");
show(45, "Cheese cutoff");
reconcile(60);
show(60, "Vegetable cutoff");
show(70, "All sale windows closed");
