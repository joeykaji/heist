# Shared demo browser acceptance — October 25, 2026

Verified in the Codex in-app browser against an isolated local Node server on port 4174. The existing homepage demo and its saved browser data were not reset. The verification session used a separate temporary persistence file.

| Check | Result |
|---|---|
| Shared staff, market and offer routes | Loaded successfully |
| Normal scenario review | Recommended South West Wrap at $2.80 from $3.99 |
| Authorization before acknowledgment | Market retained $3.99 and showed awaiting confirmation / zero purchasable units |
| Acknowledgment | Market refreshed to $2.80 with 29.8% savings |
| Exact offer navigation | Market linked to `/offers/CONN-SWRP-0` |
| Purchase and fulfillment across tabs | Purchase reserved one unit, Staff showed accepted order; fulfillment reduced physical and reserved units once |
| Refresh | Confirmed price and shared session persisted |
| Focus after commands | Review and purchase retained focus; +30 minutes retained focus on the exact button |
| Inventory draft during another tab's update | Edited count of 9 and input focus survived clock advance; stale status still refreshed |
| Stale inventory | Advancing beyond 30 minutes disabled purchase; explicit recount restored eligibility |
| Server disconnect | Offline banner and disabled mutations appeared even with inventory input focused |
| Restart/reconnect | Live connection, committed price and fulfilled order recovered without page reload |
| Keyboard skip link | Tab focused the link; Return focused main content |
| Narrow storefront | 475px viewport, no document horizontal overflow; status visible |
| Desktop terminal | 1280px viewport, side-by-side quotes and selected offer reviewed visually |
| Console | No warnings/errors in the checked storefront log |

Screenshots: [desktop terminal](market-desktop.png), [narrow storefront](shop-mobile.png). These capture synthetic data after the walkthrough, with other batches explicitly stale.

Fixes made during acceptance: preserve focus and in-progress form values across live renders, distinguish buttons sharing an action by all identifying data attributes, discard focus/drafts across session generation changes, expose a keyboard skip link, and keep connection status visible on small screens. State and action availability now continue refreshing during edits.

Remaining acceptance work: runtime reduced-motion preference verification, complete keyboard-only walkthrough, contrast measurement, additional browsers, and an automated browser smoke suite. Existing reduced-motion CSS disables animation, transitions and smooth scrolling; that source inspection is not a runtime accessibility certification. The automated domain/application/HTTP suite remains the reproducible regression baseline.
