# Hackathon demonstration — Restaurant Continuity Mode

**Project:** Restaurant Continuity Mode — *Every table. Every promise. Still yours.*

## 2-minute judge walkthrough

**0:00–0:20 — The moment it fails**

> It's 5 PM. Reservations are about to arrive, and your booking provider is down. The restaurant has two bad choices: turn everyone away or risk double-booking tables. Continuity gives the host a third option: operate independently, but only with evidence-backed commitments.

**0:20–0:40 — Recover what you know**

> Here's the host stand's live run-sheet. We brought in an authorized 2 PM backup, with guest names, arrival times, party sizes and table assignments. One guest has no verified table — so we don't fabricate capacity. We flag it for a manager and protect a table hold.

Show **Overview**, then the amber **Needs verification** guest row.

**0:40–1:05 — See what you can trust**

> The map makes a critical distinction: green means independently verified and uncommitted; gray is uncertain; amber is protected; and slate is already committed. That difference matters. Stale imported data never means a table is free.

Show **Floor & inventory**, then one unverified patio table. Optional: show the manager-only **Verify full evening** action without taking it.

**1:05–1:30 — Book without breaking promises**

> A new party of two calls for 9 PM. Continuity finds a specific verified free table. I confirm, and the server creates a booking and a confirmation code — with a database transaction that blocks overlapping confirmations. Two hosts clicking at once cannot reserve that same table and time.

Open **New reservation** → select **9:00 PM**, party **2** → **Check tables** → choose green table → **Confirm**. Search again to demonstrate that table is unavailable. Avoid claiming the standalone UI itself proves concurrency; the automated backend test does.

**1:30–1:50 — Recover cleanly**

> When the primary provider returns, we don't blindly replay changes. Managers compare the restored reservations to the outage ledger, resolve conflicts, export an audit record, and explicitly sign off. There is no unauthorized write-back.

Open **Recovery & reconcile** → point to comparison and exception queue.

**1:50–2:00 — The takeaway**

> Restaurant Continuity Mode isn't another booking marketplace. It's the safety net that keeps service moving when the marketplace goes dark.

## What the prototype demonstrates

- Independent service workspace with a functioning API and persisted SQLite ledger.
- Real server-side authorization and atomic overlap checks, covered by automated tests.
- CSV preview/recovery, optional sample-format email parser, protected holds, claims, audit exports and reconciliation.

## What not to claim

- **Not** an official Resy integration, certified backup export, or access to private APIs.
- **Not** production-grade security, turnkey multi-restaurant deployment, or total offline operation.
- **Not** an AI phone agent or fully automated provider recovery; these are outside the PRD MVP.
- **Not** reconstruction of bookings when no backup, authorized record, or guest evidence exists.

## Demo staging

Use the seeded manager account first. Keep an optional CSV ready. The database is reset by deleting `continuity.db` after stopping the app. The screenshots in the ZIP are examples; UI state will change as the demo proceeds.
