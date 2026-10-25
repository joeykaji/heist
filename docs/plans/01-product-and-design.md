# Product and visual design

## Goal

Make surplus-food offers feel like an active exchange while keeping current price, availability, and pickup deadline immediately understandable. The interface should look convincing on a presentation display and remain usable on a phone.

The exchange trades food offers, not financial securities. Do not add fictional market capitalization, stock returns, or invented price ticks to make it resemble a terminal.

## Screens

### Customer storefront: `/`

- MarketBite logo and navigation between “Shop” and “Market”; shared location, connection status, and simulation badge.
- Food cards with image or intentional placeholder, name, current confirmed price, regular price, savings, available quantity, pickup deadline, and availability.
- Product detail at `/offers/:offerId`: supplied ingredients/allergens, exact batch offer, price explanation, small confirmed-price history, and simulated purchase flow.
- Show quantity, price, and deadline before explicit purchase confirmation; show accepted price and order identity afterward.
- Optimize for mobile browsing and clear purchasing. Keep full scenario economics in the staff workspace.
- Mark unavailable offers clearly and disable purchasing when paused, stale, sold out, closed, disconnected, or awaiting reconciliation of uncertain checkout state.

### Market terminal: `/market`

- Compact logo, Shop/Market navigation, location, simulated clock, connection status, simulation badge, and fullscreen control.
- Dense quote table: food name, optional stable display symbol, confirmed price, regular price, savings, actual discount, last confirmed price change, available units, and cutoff.
- Selected-offer panel with large step chart, batch identity, current savings, price confirmation time, inventory observation time, and explanation.
- Scrolling offer ticker and timestamped activity feed driven by shared confirmed price and inventory events. Display symbols identify food offers; they are not real securities.
- Summary strip for available units, active offers, next operational event, and accepted simulated orders; do not label forecasts as realized profit or waste reduction.
- “View offer” opens `/offers/:offerId` for the selected offer. The terminal is a viewing surface; purchases use the storefront flow.
- Wide presentation layout and compact mobile layout. Fullscreen hides navigation chrome without creating a separate data session.

Use three seeded products first. Both public experiences show the same offer IDs, confirmed prices, quantities, and deadlines. More products should improve the demonstration rather than fill repeated panels.

### How the views work together

1. Staff reviews and authorizes an offer change in `/staff`.
2. Mock checkout acknowledges it; one persisted event updates storefront cards, detail, terminal quotes, ticker, and chart.
3. A viewer selects an offer in the terminal and follows it to the storefront without losing offer/batch identity.
4. A storefront purchase reserves units once. Both public views update availability; the terminal records the accepted purchase.
5. Staff fulfillment, pause, closure, or reconciliation updates both public views from the same state.

Navigation preserves the session and provides a return link to the selected market offer. A closed or replaced offer's URL shows its own unavailable state and links to current offers; never silently substitute a new batch into the purchase flow. Different tabs need not share selection, but must share authoritative data.

### Staff view: `/staff`

- Clearly identify this as an unauthenticated demo control surface.
- Product/batch list with physical stock, reservations, protected units, buffer, offer availability, count age, and deadline.
- Actions: reconcile physical count, record removal, approve/pause/resume/close, review candidate diagnostics, authorize recommendation, and simulate checkout failure.
- Pricing details: candidate price, expected incremental contribution, worst listed scenario gain, expected sales uplift, gate outcomes, missing evidence, and decision commitment.
- Separate recommendation, pending checkout, and published price states. A recommendation must never appear as a purchasable price.
- Demo controls: pause/run simulated time, speed, advance to next event, scenario selection, reset.

### Optional later: inventory case

A stylized food display case can animate accepted sales and restocks from inventory events. It is a visualization of tracked inventory, not a sensor. Build it only after the core flow is complete.

## Visual system

- Background: near-black; panels: slightly lighter charcoal; thin neutral borders.
- White text, muted gray secondary text, MarketBite gold for headings and selection, brand green for savings.
- Use a readable sans serif for names and controls; a monospace face with tabular numerals for prices, counts, and timestamps.
- Share logo, tokens, status wording, and core offer components. Use spacious food cards in Shop and aligned compact columns in Market; the two layouts serve different tasks.
- Use text and arrows alongside color. Green means customer savings; price increases are not part of this model.
- Status vocabulary: Available, Awaiting confirmation, Paused, Review needed, Sold out, Closed. Keep internal pricing results available in staff details.

Initial tokens may start at background `#080A09`, panel `#111512`, gold `#E8B92F`, green `#39C982`, text `#F4F5F1`, muted `#A3ACA6`. Verify actual contrast before finalizing.

## Logo preparation

1. Copy the supplied original into `public/brand/marketbite-original.png` so the app never depends on Downloads.
2. Produce a display derivative cropped to the visible wordmark with a small safe margin; preserve aspect ratio and the original asset.
3. The supplied black background suits the header. Do not stretch, recolor, redraw, or invent a standalone leaf icon.
4. Request a vector/transparent version only if needed later; the initial build can use the supplied raster.
5. Give the image the accessible name “MarketBite.” Do not duplicate its wording in adjacent decorative text.

## Charts and animation

- Plot confirmed effective prices as a step function; render actual event times on the horizontal axis.
- Keep first-event change blank. Calculate savings, discount, event change, and price index from confirmed integer-cent prices.
- Permit at most one downward price step per batch/window. New batches get separate histories; do not splice them into a misleading continuous series.
- End the line at withdrawal, sale completion, or closure. Never draw an artificial zero price.
- Briefly highlight a confirmed markdown and update its table row. Animate stock changes separately from prices.
- Countdown updates and feed events provide activity between markdowns. Do not jitter a flat price chart.
- Honor `prefers-reduced-motion`; provide static state changes and disable ticker scrolling/flash effects.

## Responsive and accessible behavior

- Wide screen: storefront card grid and offer detail; terminal quote table and large chart, with activity feed alongside or beneath.
- Tablet: reduce storefront grid columns; terminal table plus selected detail with activity below.
- Phone: storefront cards and purchase flow; compact terminal quotes and selected chart; staff controls remain fully operable.
- Support keyboard selection, visible focus, labeled fields, inline validation, accessible dialog focus, and explicit loading/error states.
- Avoid announcing each clock tick to screen readers. Announce purchase outcomes and meaningful availability changes politely.

## Product acceptance

- A viewer can identify the current price, savings, available stock, and cutoff without watching an animation.
- Logo remains legible at header size; no empty image margins dominate the layout.
- Storefront and terminal agree on price, availability, and deadlines after staff/checkout events.
- Terminal-to-storefront links preserve exact offer identity; purchases return an outcome visible in both views.
- Simulated operations and scenario forecasts are labeled where shown.
- No food safety, dietary, integration, demand, or environmental claims are invented.

## Interface scope correction

Preserve the existing home, Cafe Display, Mobile Display, Sustainability, and Cafe Desk interfaces. Only `/market` receives the Bloomberg-inspired terminal styling. Shop/staff redesigns described above are superseded by this constraint; reuse the existing menu and desk for those workflows. Keep terminal CSS scoped to its separate page.
