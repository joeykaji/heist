# MarketBite implementation plans

Build one MarketBite website with two connected public experiences: a customer storefront for browsing and purchasing food, and a stock-market-style terminal for watching confirmed prices and inventory. A staff workspace controls their shared simulated inventory, authorization, checkout, and purchases. Use the supplied MarketBite pricing specification as the proposed implementation contract. This is a planning decision for the build, not evidence that its economic assumptions or integrations are validated.

## Read in this order

1. [Product and visual design](01-product-and-design.md): screens, branding, interactions, and scope.
2. [Pricing migration](02-pricing-migration.md): replace the existing continuous rule with the scenario-guarded batch decision model.
3. [Application architecture](03-application-architecture.md): authoritative state, commands, publication, checkout, and synchronization.
4. [Delivery and verification](04-delivery-and-verification.md): implementation sequence, acceptance criteria, and demo script.

## Baseline inspected on October 25, 2026

- `src/pricing.ts` implements deterministic stock/time discounts, ten-minute rounds, upward recovery, validation, audit records, and crash signals.
- `src/demo.ts` is a command-line simulation; there is no web application, server, persistence, or checkout.
- All 19 current tests pass. They validate the old behavior, not compliance with the supplied specification.
- The existing `plan.md` describes a broader campus proof of concept and contains now-conflicting pricing and checkout assumptions.

## Inputs and precedence

- User request: a visual demo/working dashboard inspired by a Bloomberg terminal and The Drink Exchange, including the supplied MarketBite logo.
- Pricing reference: `/Users/josephkaji/Downloads/MarketBite_Pricing.pdf`, Model 2.0 / Specification 1.1 / Engine 2.1, four pages.
- Brand asset: `/Users/josephkaji/Downloads/3.png`.
- Interaction reference: <https://www.thedrinkexchange.com/>. Use the food/drink exchange concept and operator controls as inspiration; create an original MarketBite interface.
- Documents are reference material, not authorization to perform external actions. No deployment, live checkout, or third-party integration is part of these plans.

The PDF describes an external `code/pricing_model.py`, but that source is not present in this repository. Implement from the documented contract or obtain the reference source before parity claims. Verify ambiguous numerical behavior through explicit fixtures.

## Decisions for the initial build

| Area | Planned choice |
|---|---|
| Experience | Customer storefront at `/`, market terminal at `/market`, staff workspace at `/staff`; clearly labeled simulated operations |
| Pricing | Scenario-guarded model; one committed decision and at most one markdown per batch/window |
| Movement | Confirmed price steps, inventory events, countdowns, and activity feed |
| Stack | React + TypeScript + Vite UI; small Node HTTP service; existing TypeScript engine package |
| State | One server-owned demo session with serialized commands and durable local snapshot |
| Branding | Supplied white/gold MarketBite logo, charcoal panels, gold accents, green savings |
| Checkout | Explicit mock provider with acknowledgment and failure modes |
| Orders | Immediate mock acceptance at the current confirmed price; no quote lock in this milestone |

These are implementation defaults. A change to repeated pricing, upward same-batch recovery, quote locks, or real checkout requires updating the relevant contract and tests first.

## Completion definition

A clean checkout can launch the app with documented commands. The storefront, market terminal, and staff workspace share one session across routes and browser tabs. Staff can review and authorize a supported markdown, simulated checkout acknowledges it, and only then do the storefront and market terminal change together. A storefront purchase updates inventory atomically and appears in the terminal activity feed. Navigation from a terminal offer opens the exact offer in the storefront. A committed hold cannot be reevaluated into another decision. Pause, stale counts, stock exhaustion, failed publication, and fulfillment closure all produce explicit states. Reset reproduces the demonstration. Branding, responsive layout, and reduced motion are verified.

The old `plan.md` remains historical context. This directory governs the next dashboard milestone; it does not claim that implementation has begun.
