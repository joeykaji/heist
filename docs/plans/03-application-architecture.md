# Application architecture

## Structure

Use React/TypeScript with Vite for the web UI and a small Node HTTP service for commands and snapshots. Keep the pricing decision function independent of both. Choose an HTTP framework and schema validator during setup, pin dependencies, and document runtime requirements.

Suggested layout:

```text
src/domain/          pricing types, decimal arithmetic, decision engine
src/application/     commands, session reducer, publication, orders, clock
src/server/          HTTP routes, event stream, persistence
src/demo/            seeded scenarios and scripted events
web/src/             storefront, market terminal, staff view, charts, shared UI
public/brand/        original logo and display derivative
test/                domain, application, integration fixtures
```

Run frontend and backend through one documented development command. Proxy `/api` during development; serve the compiled frontend from the same origin for the packaged demo.

## Routes and shared client data

- `/`: customer storefront.
- `/offers/:offerId`: exact batch offer detail and simulated purchase.
- `/market`: stock-market-style terminal; `?offer=:offerId` restores selected chart.
- `/staff`: staff controls and pricing diagnostics.

All routes use one session client/store, money formatter, availability selector, and confirmed-price history adapter. Route changes never reset the session or create a second pricing engine. Selection and fullscreen are local presentation state; price, inventory, orders, and clock are server state.

Serve the application shell for direct route loads and refreshes. Validate offer identifiers and render explicit unknown/closed-offer states. Do not use product ID alone as an order target when multiple batches exist.

Public read models include confirmed offer price/version, availability, inventory, deadline, and public events. Staff diagnostics remain in the staff read model. The simulated customer order path is shared by offer links from either public view; the terminal does not implement independent checkout.

## Authoritative session state

The server owns a demo session with a monotonically increasing revision:

- Products: identity, name, regular price, approved imagery, supplied ingredient/allergen details.
- Batches: immutable identity/window identity, product/location, physical stock, reservations, protected units, buffer, approvals, cutoff, count observation timestamp.
- Policy and scenarios: versioned reviewed inputs and provenance labels identifying synthetic demo assumptions.
- Decisions: input snapshot/hash, result diagnostics, evaluated time, commitment and markdown count.
- Offers: batch-specific checkout mapping, confirmed price/version/effective time, publication state, withdrawal state.
- Orders: unique operation ID, quantity, accepted price/version, acceptance and fulfillment status.
- Events: ordered revision, event ID, simulated time, recorded time, entity identity, event type, and relevant payload.
- Clock: simulated epoch, run/pause state, speed, and real-time anchor.

Do not let browser state authorize price changes or supply trusted current prices. Use stable batch/window identity; stock changes do not clear commitment. New stock belongs to a new batch, with explicit allocation, rather than silently joining an already committed batch.

## Commands and read APIs

Read API: session snapshot and an SSE event stream, including revision/event IDs. Commands include expected revision and a unique idempotency key.

Commands: reconcile count, record removal, create batch, approve, pause/resume, close, review decision, commit evaluated hold, authorize markdown, accept mock order, advance/pause clock, select scenario, reset.

Validate all requests server-side. Serialize mutations for the demo session. Return a revision conflict with a fresh snapshot when a stale command cannot safely apply. Retry duplicate operation IDs by returning the original outcome, not reapplying the operation.

Each client loads a snapshot, subscribes to events, and refetches on revision gaps/reconnection. Use an atomic subscribe/snapshot boundary or replay events after the snapshot revision so no events are lost during setup. A disconnected storefront or terminal shows connection status; storefront purchases are disabled. Both views label cached data as disconnected rather than implying it is currently executable.

## Price publication state machine

```text
reviewed recommendation
  -> staff authorization
  -> pending mock checkout update
  -> checkout acknowledgment
  -> persisted confirmation + commitment + price event
  -> publication to storefront + market terminal + staff view
```

- Before execution, recheck clock, operational eligibility, available stock, input/policy revision, batch/window commitment, and checkout state.
- An authorization references the exact evaluated recommendation and inputs. Reject changed inputs rather than publishing stale economics.
- Do not hold a state mutation lock across an asynchronous provider request. Persist a pending operation, block conflicting publication, and revalidate on acknowledgment.
- On acknowledgment, persist the confirmed price, checkout version, completed commitment, markdown count, and event together before broadcasting.
- If conditions become invalid while pending, withdraw the offer and reconcile provider state. Do not publish an acknowledged price as available after closure.
- Explicit failure keeps the previous confirmed price only while operationally valid; otherwise withdraw. It does not commit a markdown.
- An ambiguous timeout remains pending/unknown until provider reconciliation by operation ID. Do not blindly issue another update or accept purchases against uncertain provider state.
- An evaluated HOLD commits once without a price event. Early administrative HOLD and REVIEW do not commit.

The mock provider must support success, rejection, delay, and unknown-result/reconciliation paths. Label it simulated throughout the UI.

## Inventory and orders

Offer availability is physical stock less disjoint reservations, protected allocations, and buffer. Reject impossible corrections; do not clamp negative values silently.

For the first milestone, a purchase command uses the displayed checkout version. The server rechecks availability, timing, approval, freshness, publication state, and current version. If the version changed, return the fresh price for explicit reconfirmation; do not silently charge a higher amount.

Accept order and reserve units atomically with idempotency. Acceptance increases reservations; it does not also decrement physical stock. Fulfillment decreases both physical stock and the matching reservation. This avoids double-counting an accepted order. Orders retain their accepted price.

Cancellation releases a reservation only after an explicit eligibility decision; closed/unsafe stock does not return to the purchasable pool. Record donations/transfers and discards separately. Restocks receive new batch IDs and cannot reset a prior decision on residual stock.

Quote locks, ten-minute reservations, refunds/payment settlement, and no-phone kiosk flows remain later work. The old checklist's quote behavior is not part of this milestone.

## Scheduling and clocks

The server derives decision inputs such as remaining minutes and count age from timestamps. The browser formats campus time as `America/New_York`.

Reevaluate operational availability on clock advancement, approval/inventory commands, freshness expiry, and fulfillment-buffer boundary. Pricing comparison is an explicit review action, not a timer. After commitment, continue availability checks without reoptimization.

Define one operational `withdrawAt` at cutoff minus fulfillment buffer. Stop new acceptance at that boundary; accepted orders retain their price and must fulfill by cutoff. A paused clock pauses simulated deadlines, not network/connection indicators.

Reset creates a new session generation and discards previous state, pending operations, and histories together. Reject delayed callbacks from prior generations. Advancing over several deadlines must process closure correctly without inventing intermediate prices.

## Persistence and failure handling

Use a single-process JSON snapshot and operation-result/event journal for this local demo. Write snapshots via temporary file plus atomic rename; publish success only after persistence. Bound event history and document that the design is not a multi-instance production database.

On restart, validate persisted schema and reconcile pending mock operations before allowing purchases. On persistence failure, reject the command and expose an actionable error. Never silently reset a damaged session.

Production authentication, provider credentials, multi-instance locking, durable database transactions, and real payments are separate milestones. Bind the demo service locally by default; exposing it publicly requires a separate hosting/access decision.
