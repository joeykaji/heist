# MarketBite

**Taste more. Waste less.**

MarketBite is a campus dining prototype that connects surplus inventory with timely price changes, live menu displays, and mobile deal alerts. Its goal is to help cafes sell more prepared food, make meals more affordable, and reduce the resources and carbon emissions associated with food waste.

Built by University of Rochester students for the Sustainability track of the Ain Center’s **The Heist Hackathon**, the prototype uses Connections Cafe as its demonstration setting. The concept adapts the live pricing experience of stock market bars to campus food retail.

[Explore the live demo](https://marketbite-cafe-tv.alight-lemur-9585.chatgpt.site) · [Browser verification notes](docs/verification/browser-acceptance.md)

## Features

Six connected views share the same browser-local inventory, pricing rules, and simulated cafe day.

| View | Route | Purpose |
| --- | --- | --- |
| Home | `/?view=home` | Project background, sustainability goals, and team. |
| Cafe Display | `/?view=tv` | A rotating 16:9 photo menu, scrolling price ticker, and shared playback controls beneath the board. |
| Exchange Display | `/?view=exchange` | A market-style board with prices, availability, batch price histories, and a scrolling ticker. |
| Mobile Display | `/?view=mobile` | A searchable menu, category navigation, price drops, simulated checkout, and deal notifications. |
| Sustainability | `/?view=sustainability` | Simulated food movement, surplus sales, customer savings, and sell-through, linked to the active pricing model. |
| Cafe Desk | `/?view=inventory` | Configuration for hours, products, stock, traffic, pricing, and offers, plus The Cafe Day simulation with its 3D case, charts, and event controls. |

Cafe Display rotates six foods per page; Exchange Display rotates twelve. Both rotate every 15 seconds, support category filtering, and provide a **TV Display** button for fullscreen presentation. Matching playback ribbons beneath the boards control the same cafe day as Cafe Desk, Mobile Display, and Sustainability. Restart returns to opening and pauses the simulation. Standalone display routes are `/?display=1` and `/?display=exchange`.

## Quick Start

Install Node.js and npm, then run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**. The development command builds the browser assets before starting the local server.

| Command | Description |
| --- | --- |
| `npm run dev` | Build the application and start the local server. |
| `npm run build` | Generate pricing modules and copy the server-demo and Exchange Display assets into `dist/`. |
| `npm test` | Build and run the current JavaScript tests and isolated legacy tests. |
| `npm run typecheck` | Check TypeScript compatibility. |
| `npm run demo` | Run the command-line pricing scenario demo. |

## Configure a Cafe Day

Cafe Desk follows a setup → simulation → live review workflow. Apply each section before moving to the next.

1. **Hours & Day** — Set same-day opening and closing times, at least two hours apart.
2. **Menu & Starting Prices** — Add or hide products and edit names, ticker symbols, categories, opening quantities, prices, and images. Choose a supplied photo, no photo, or a custom HTTPS image URL.
3. **Pricing Rules** — Configure review intervals, discount limits, selling fees, and minimum contribution. Product costs and minimum prices are set with the menu.
4. **Customer Traffic & Rushes** — Set in-person and mobile purchase rates, rush schedules, and multipliers.
5. **Scheduled Offers** — Configure a Food Bundle or Market Crash and choose when it runs.
6. **The Cafe Day** — Play the saved plan, adjust playback speed, launch events, and watch the 3D case, charts, and activity.
7. **Live Stock & Price Review** — Optionally receive deliveries, reconcile counts, and review manual price adjustments during the day.

Changes to the saved opening plan replay the day to the current simulated time. Moving the timeline also rebuilds the day from that plan; **Restart** returns to opening time and pauses playback. A fresh delivery creates a separate batch with its own pricing history.

Default opening stock is **10 units per food**. Hours are **7:00 AM–3:00 PM**, with 12 in-person purchases and 8 mobile orders per normal hour. Breakfast and lunch use a 2× multiplier; Closing Rush begins at 2:00 PM with a 1.5× multiplier. These are configurable simulation inputs, not measured cafe demand. Actual simulated purchases require available stock.

Food Bundles combine two items at their current prices. Market Crash announcements highlight price drops within the pricing rules. Offers appear across the displays and notification preview. Closing Rush is a traffic event, not an offer type.

## Pricing Model

The active controller is [`src/domain/dynamic.mjs`](src/domain/dynamic.mjs). It adjusts prices using available inventory and progress through a batch’s selling window. It is a rules-based simulation, not a calibrated demand forecast or profit optimizer.

With the default 45% maximum discount, the target before floor and step limits is:

```text
target price = regular price ×
               (1 − 0.45 × window progress × min(1, available units / reference units))
```

- **Available units** exclude reservations, protected allocations, and buffer stock.
- **Reference units** are recorded when a batch is received.
- **Window progress** runs from receipt to cutoff and is bounded between 0 and 1.
- Prices are reviewed every **30 simulated minutes** by default. Cafe Desk supports 15-, 30-, or 60-minute reviews.
- Purchases affect the next review; they do not immediately change the published price.
- Prices may decrease as time passes or increase as available stock falls, but never exceed the regular price.

### Price and Inventory Safeguards

Targets and floors round upward to whole cents. The minimum permitted price is the greatest of:

```text
1 cent
merchant-set minimum price
regular price × (1 − maximum discount)
(sale cost + allocated fixed fee + required contribution) / (1 − fee fraction)
```

The maximum discount is capped at 45%. Each review normally changes the price by no more than 5% of the regular price, rounded up; a higher binding floor may require a larger correction.

Offers require reviewed economics, approval, supported checkout, and a fresh inventory count. Counts older than 30 minutes pause availability, and new orders stop five minutes before cutoff. Browser playback supplies synthetic observations; the server demo requires staff reconciliation.

Scheduled adjustments are acknowledged automatically by the demo checkout adapter. Manual recommendations require authorization and acknowledgment. Pending or uncertain checkout operations exclude a batch from automatic updates. Versioned quotes reject stale purchases, while accepted orders retain their quoted prices.

Charts show confirmed price events only. Visual histories are simplified to at most 32 samples in half-hour buckets; exact events remain available in the history table. Lines illustrate trends, while checkout prices stay fixed between confirmed changes.

## Sustainability Measurement

The Sustainability view uses the same simulation state as the menu displays. It tracks discounted and regular-price sales, remaining food, transfers, retained stock, recorded discards, revenue, and customer savings.

These indicators help explore how pricing could encourage surplus purchases. **A discounted sale is not automatically counted as food waste or carbon emissions prevented.** A real pilot would need to weigh discarded food, compare equivalent days with and without MarketBite, and apply appropriate food-specific emissions factors. Food retained at closing is tracked separately from discarded food.

## Architecture

The repository includes two demonstration modes:

| | Browser-local prototype | Shared server demo |
| --- | --- | --- |
| Entry points | The six `/?view=...` routes | `/shop`, `/market`, `/staff`, `/offers/:offerId` |
| State | `localStorage`, shared across tabs on the same browser origin | One authoritative Node.js session |
| Synchronization | Storage events and Web Locks where supported | Revisioned snapshots over Server-Sent Events (SSE) |
| Persistence | Browser storage | `.marketbite/session.json` |
| Accepted purchases | Immediately fulfilled in the simulation | Reserved until staff explicitly fulfill them |
| Hosting | Static `dist/` deployment | Node server required |

The two modes have separate state. The public static website does not expose the server demo’s API.

### Repository Layout

| Path | Contents |
| --- | --- |
| `dist/` | Browser-local application, static assets, and generated browser modules. |
| `web/` | Source files for the shared server interface, Exchange Display, and price-history charts. |
| `src/domain/` | Active pricing controller, economic constraints, and retained scenario engine. |
| `src/application/` | Shared session, commands, and checkout coordination. |
| `server.mjs` | Local HTTP server, API routes, and SSE updates. |
| `scripts/` | Build and asset-copy scripts. |
| `test/` | JavaScript tests. |
| `docs/verification/` | Browser acceptance notes and screenshots. |

The earlier scenario optimizer in `src/domain/decide.mjs` and generated `dist/pricing.mjs` is retained for compatibility and historical tests. The continuous TypeScript engine runs through the isolated legacy scripts; neither replaces the active stock/time controller.

### Shared Server Walkthrough

With `npm run dev` running, open `/staff`, `/market`, and `/shop` in separate tabs.

1. In **Staff**, reset the session, select a batch, and preview its stock/time price recommendation.
2. Authorize the recommendation. **Market** keeps the existing price while checkout confirmation is pending.
3. Acknowledge publication to make the new price visible.
4. In **Market**, select **Buy this exact offer** and confirm a simulated purchase.
5. Return to **Staff** to fulfill the reservation and observe the synchronized inventory updates.

The server also supports rejected publications, uncertain checkout outcomes, and reconciliation. Commands are serialized, reconnecting clients receive the current snapshot, and resetting creates a new session generation that invalidates older commands.

## Deployment

GitHub Pages deployment is defined in [`.github/workflows/pages.yml`](.github/workflows/pages.yml). A repository administrator must first open **Settings → Pages** and select **GitHub Actions** as the source. Then run **Deploy MarketBite to GitHub Pages** from the Actions tab, or push a commit to `master`.

After setup, each push to `master` builds and publishes `dist/` automatically. The public address will be **https://joeykaji.github.io/heist/**. View links use the same prefix, for example `https://joeykaji.github.io/heist/?view=tv`. The GitHub Pages deployment hosts the browser-local prototype only; each visitor has their own simulated cafe day.

For a static deployment, run `npm run build` and serve `dist/`. The existing Sites configuration is stored in `.openai/hosting.json`.

The shared server demo requires `server.mjs` and persistent storage; a static deployment alone cannot serve `/api` or the shared session. The local server binds to `127.0.0.1` and defaults to port 4173; `PORT` can override the port.

## Validation

The test suites cover pricing targets and floors, bidirectional adjustments, scheduled reviews, inventory allocation, stale quotes, authorization, publication failures, reservations, fulfillment, fresh batches, persistence, deterministic replay, price histories, and sustainability totals.

Browser acceptance results and outstanding accessibility checks are documented in [`docs/verification/browser-acceptance.md`](docs/verification/browser-acceptance.md).

## Prototype Scope

- No live POS, Grubhub, payment, or real-order integration. Mobile notifications are simulated within the page.
- Browser-local state is not synchronized across devices. The server demo has no staff authentication and is not ready for production use.
- Traffic, inventory observations, products in the server demo, and economic assumptions are synthetic. No measured waste reduction, carbon savings, or demand calibration is claimed.
- Production checkout would require authenticated staff access, operational cancellation and refund handling, and a durable authoritative transaction ledger.
- The 3D case shows nine representative foods, with up to eight models per food. Additional units are counted as back stock; the full inventory remains available in Cafe Desk.

## Team

| Name | Role |
| --- | --- |
| [Mateo Santalucia](https://www.linkedin.com/in/mateo-santalucia) | Product & Creative Lead |
| [Jake Gates](https://uk.linkedin.com/in/jakegates) | Business & Pitch Lead |
| [Joey Kaji](https://www.linkedin.com/in/joseph-kaji-018a72280) | Technical Lead |
| [Markian Dwulit](https://www.linkedin.com/in/markian-dwulit-75773a344) | Sustainability Analyst |
| [Sonia Irakoze](https://www.linkedin.com/in/irakoze-sonia) | Sustainability Analyst |

## Assets and Acknowledgments

The Connections Cafe menu was transcribed from supplied screenshots, with duplicate listings consolidated and beverages excluded. Food photography is AI-generated and representative; logos were supplied by the project team. See [`dist/image-notes.txt`](dist/image-notes.txt) and [`dist/image-prompts.json`](dist/image-prompts.json) for provenance.

Third-party libraries include **Three.js 0.160.1** and **Decimal.js 10.4.3**, distributed under the MIT License. Both are served locally with their license notices. Typography uses DM Sans, Manrope, and Roboto Slab; applicable font notices are retained with the assets.

## Interface Copy

Titles, controls, and field labels use a consistent capitalization standard. See [UI copy conventions](docs/ui-copy.md) when adding or editing interface text.
