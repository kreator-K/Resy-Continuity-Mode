# Continuity — Restaurant Continuity Mode

A runnable, local-first **restaurant-operated contingency workspace** built from *Restaurant Continuity Mode PRD v1.0 (October 7, 2026)*. When a booking provider is unavailable but the restaurant still has internet access, hosts can record and verify existing commitments, manage tables, safely accept new bookings, and manually reconcile later.

> **Demo / reference implementation, not a production-ready service.** The venue, staff, and guests are fictional. There is **no Resy API integration**, live inventory feed, SMS sending, or automatic write-back. Do **not** enter real guest personal data. Production use requires security, legal, accessibility, operations, and deployment reviews.

## 1. Launch in approximately two minutes

Install **Python 3.10+**. Open a terminal inside this folder and run:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python run.py
```

On Windows, double-click `start_windows.bat`; it creates a virtual environment and installs dependencies. On macOS, double-click `start_mac.command` after Python is installed (Terminal may require you to grant execution permission). Both launch scripts install packages inside a local `.venv` instead of your system Python. For a manual Windows launch, run `py -m venv .venv`, `.venv\Scripts\activate`, `python -m pip install -r requirements.txt`, and `python run.py`.

Visit **http://127.0.0.1:8765** in Chrome, Safari, Firefox, or Edge.

| Role | Username | Password |
|---|---|---|
| Floor manager | `manager` | `demo123!` |
| Front-of-house host | `host` | `demo123!` |

The login screen also has one-click manager and host demo options. Both credentials are intentionally insecure demo defaults. The server listens on `127.0.0.1` only; do not expose this version on a public network.

**Important:** The app must run through its Python server, **not** by double-clicking `static/index.html`. The server supplies authentication and the database transaction that prevents conflicting bookings. A static HTML-only version could not honestly provide these safety guarantees.

## 2. What works in the prototype

| Experience | Behavior |
|---|---|
| Continuity activation | Manager activates an incident for a service date and supplies a reason; the demo starts with an active incident and seeded, fictional backup data. |
| Manager and host roles | Authenticated bearer sessions, server-side manager permission checks, independent per-session access. |
| Reservation ledger | Search by guest, contact, time, or source. Check in, seat, complete, and inspect booking states. |
| Approved CSV recovery | Upload/paste a CSV, preview invalid dates, duplicates, and unknown table labels; ready rows import as **unverified** existing bookings. |
| Digest example | Optional parser for sample lines in the format `6:30 PM \| Guest Name \| 2 \| T01 \| Phone`. This is **not** a verified official Resy digest schema. |
| Guest claims | Log unlisted guests as pending evidence-backed commitments for manager review. |
| Inventory map and timeline | 14 seeded demo tables; visual status of verified free, committed, protected hold, or uncertain. The map is informational; the booking API is authoritative. |
| Manager inventory verification | A manager explicitly verifies a table and time window. Otherwise it cannot be used for automatic confirmation. |
| Protected capacity | Manager holds block the overlapping table/time, and can be released by manager. |
| Safe new booking | Booking engine re-checks capacity and conflicts **within a SQLite `BEGIN IMMEDIATE` transaction**. An idempotency key stops duplicate creation on retries. |
| Kitchen pacing | Informational 15-minute covers chart with 16-cover advisory benchmark. Not a hard booking gate. |
| Recovery and reconciliation | Manager uploads the restored provider export, compares local-only, provider-only and changed records, reviews exceptions, and records sign-off. **No provider write-back.** |
| Exports | UTF-8 BOM CSVs: reservations, event audit, and reconciliation report including incident sign-off and exception outcomes. |
| Paper fallback | Printable run-sheet on Overview. |

### PRD-specific safety conditions

- A booking is only confirmed after a restaurant operator selects a specific **independently verified** table and the backend atomically protects the requested time.
- Existing reservations with missing/unknown table assignments are not silently reclassified as confirmed or free inventory. Managers can create protective capacity holds.
- Reservation windows use 90 minutes for parties of 1–2, 120 minutes for larger parties, plus 15 minutes turnover (fixed for this demo).
- A guest claim from an unavailable provider remains **unverified** pending evidence review.
- The app is independent of the primary provider's uptime. It **does require internet** in the intended MVP deployment; this downloadable demo runs over local loopback.
- Reconciliation is manual; comparing a restored CSV does not resolve exceptions on its own or change the provider's records.

## 3. Demo flow for judges

1. Sign in as **manager**. Review the 2:00 PM demo digest import, 14-table map, current run-sheet, and one pending conflict.
2. Select **Floor & inventory**. Note that unverified patio tables are gray; a manager can verify a table after inspecting commitments or add a protective hold.
3. Select **New reservation**. Search **9:00 PM, party of 2**; choose a green, verified table and confirm it. The system issues a local confirmation code.
4. Try the same time/table again. The previous table is no longer shown as available. Two simultaneous server requests are covered by an automated test: only one can succeed.
5. Use **Reservations → Log guest claim** to demonstrate how a guest missing from backups is recorded without inventing availability.
6. In **Import backup**, use the example CSV, preview, and show that new rows are imported only as unverified.
7. In **Recovery & reconcile**, upload a restored export, review differences, document exception handling, and export a report. Manager sign-off closes the incident; outstanding conflicts require resolution or a documented override.

See [DEMO_PITCH.md](DEMO_PITCH.md) for a timed 2-minute narration.

## 4. Input formats

**Reservation CSV headers:**

```csv
guest_name,party_size,date,time,table,phone
Sample Guest,2,2026-10-07,20:45,T01,
```

Required columns: `guest_name`, `party_size`, `date` (YYYY-MM-DD), `time` (24-hour HH:MM). Optional: `table`, `phone`.

Use the service date shown at the top of the application. The sample file supplied targets **October 7, 2026**; change the date if you launch on a later day and activate that date's incident. Imports and restored-provider comparisons require an incident active on the corresponding date.

**Shift Digest sample parsing:**

```text
8:45 PM | Sample Guest | 2 | T01 | 555-0100
```

Pasting arbitrary emails or claiming official Resy email field support is not justified; adapt the parser only after obtaining a sample the restaurant is authorized to use.

## 5. Data and reset

`continuity.db` is created automatically in this directory upon first server start. The first run creates one fictional venue, 14 tables, nine reservations, one unassigned-guest exception, a 2:00 PM sample provenance record, protective holds, and manager-approved table windows. **The ZIP intentionally excludes the database** so every installation begins with fresh seed data.

To reset the demo: stop the server, **delete `continuity.db`**, then run again. SQLite uses WAL and may create `-wal` / `-shm` files while the server is open.

Time zone is currently configured as `America/New_York`. Internally, booking times are stored in UTC and presented in restaurant-local time; the prototype uses one venue per database.

## 6. Run tests

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q tests
```

Tests use isolated temporary databases and include server-side role access, unverified capacity, retry idempotency, concurrent same-table conflict, CSV validation, guest claims, recovery sign-off, and UTF-8 export.

## 7. Remaining work before production

This is a functional hackathon implementation, **not a PRD P0 sign-off**. Gaps include production-grade authentication and password policies (demo credentials are public), request rate limiting, hardened CSRF/session and PII retention policies, production deployment/monitoring and backups, scalable cross-venue tenancy, richer evidence attachment and configurable floor setup, manager override policies, accessibility audit, operational usability trials, automated migration tooling, complete provider export schemas, and real simultaneous-device pilot tests. No customer communication, Resy synchronization, or fully offline operation is implemented.

## 8. Architecture

```text
Browser / service workspace
   ↓ Authorization: Bearer <session token>
FastAPI (Python) — server-side permissions + validation
   ↓ SQLite BEGIN IMMEDIATE + overlap checks
SQLite (reservations, table verifications, holds, incidents,
        imported evidence metadata, conflict queue, audit, reconciliation)
   ↓
CSV exports + manual restored-provider comparison
```

Run locally, validate with fictional bookings, and only move to a participating restaurant after legal/operational approval.

## Original standalone demo

The original browser-only single-file demo is preserved at [`legacy/index.html`](legacy/index.html). It is for demonstrations only and does **not** provide transactional concurrency control, reliable persistence across staff devices, or real SMS integrations. Use the FastAPI app as the authoritative version.
