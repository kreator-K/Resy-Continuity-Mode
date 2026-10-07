# Resy Continuity Mode 🍽️⚡

> **Zero-Dependency, Offline-First Incident-Response & Floor Management Operating System for Restaurants During Reservation Platform Outages.**

[![Platform](https://img.shields.io/badge/Platform-Web%20%2F%20Tablet%20%2F%20Mobile-blue.svg)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Offline--First%20%7C%20Local--First-emerald.svg)](#)
[![Zero-Dependency](https://img.shields.io/badge/Dependencies-None%20(Pure%20HTML%2FTailwind%2FJS)-amber.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](#)

---

## 📌 Problem Context & Explicit Operational Assumptions

The problem premise specifies that **Resy goes offline early in the afternoon with dinner service approaching**. To model the operational response accurately, we state the following concrete operational timeline and assumptions:

### Operational Timeline & Assumptions:

| Time | Phase | Operational Reality & Actions |
| :--- | :--- | :--- |
| **02:00 PM** *(Early Afternoon)* | **Outage Detected** | Resy goes dark nationwide. Resy's daily 2:00 PM automated shift digest email serves as the **last verified snapshot of ground truth** before platform failure. |
| **02:15 PM – 02:30 PM** | **Triage Activation** | GM realizes the outage is persistent. Staff activate **Resy Continuity Mode**, ingest the 2:00 PM email recap, and reconstruct the floor book. |
| **02:30 PM – 04:30 PM** | **The 2-Hour Golden Window** | Front-of-house staff conduct phone verification calls to guests while they are still at their desks/phones, locking confirmed parties and identifying early cancellations. |
| **04:30 PM** *(Late Afternoon)* | **Pre-Shift Staff Lineup** | 30 minutes before doors open. Triage window closes. Host stand prints emergency run-sheets for clipboards, sets kitchen pacing throttles, and exposes safe second-turn slots on the online emergency widget. |
| **05:00 PM – 05:30 PM** | **Doors Open / Service Begins** | First dinner turn begins. Floor map transitions to active service mode. |
| **05:45 PM** *(Demo Simulation Time)* | **Peak Rush Execution** | The simulated clock in the interactive prototype models active dinner service (seated tables, live turns, walk-in arrivals, and inbound online requests). |

### The Host Stand Dilemma:
1. **The Double-Booking Trap**: If the restaurant accepts new walk-ins or uncoordinated online requests blindly, they risk giving away tables when confirmed guests arrive with email confirmations.
2. **The Revenue Bleed**: If the restaurant panics and locks the doors or refuses walk-ins, they suffer massive unrecoverable revenue loss and empty dining rooms.
3. **The Kitchen Crash**: Uncontrolled seating destroys kitchen pacing, resulting in stacked tickets, long wait times, and ruined diner experiences.

**Resy Continuity Mode** is an emergency operational platform that reconstructs the floor plan from ambient digital exhaust, enables staff phone triage, enforces conflict-free table turn math, protects kitchen pacing, and provides a safe, failover online booking channel.

---

## 🏗️ System Architecture

```text
 ┌──────────────────────────────────────────────────────────────────┐
 │                     Ambient Digital Exhaust                      │
 │   • 2:00 PM Resy Automated Shift Digest Email (Last Snapshot)    │
 │   • POS Pre-Authorization Dumps (Toast, Micros, Square)          │
 │   • Transactional Confirmation Receipts & SMS Records            │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │                   Shift Ingestion & Parser                       │
 │  - Normalizes guest names, party sizes, dietary flags, and times │
 │  - Initializes local state with high-risk unverified flags       │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌───────────────────────────────┐         ┌────────────────────────────────┐
│   Host Triage & Run-Sheet     │         │   Gated Online Booking Portal  │
│  - Click-to-call verification │         │  - Only verified slots exposed │
│  - Real-time seat status      │         │  - Kitchen pacing governor     │
│  - No-show capacity liberation│         │  - Two-way host SMS handshake  │
└───────────────┬───────────────┘         └────────────────┬───────────────┘
                │                                          │
                └─────────────────┬────────────────────────┘
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │             Conflict-Free Table Allocation Engine                │
 │  • Enforces party turn times (90m for 2p, 120m for 4p)           │
 │  • +15-minute kitchen turnaround and sanitization buffer         │
 │  • Rejects any walk-in or online slot that collides with book    │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌───────────────────────────────┐         ┌────────────────────────────────┐
│      Floor Map & Tablet UI    │         │     Post-Service Reconcile     │
│  - 14 tables (Dining & Patio) │         │  - Local audit log export      │
│  - Color-coded turn timeline  │         │  - Conflict diff with Resy     │
│  - Emergency 1-click print SOP│         │  - POS check cross-reference   │
└───────────────────────────────┘         └────────────────────────────────┘
```

---

## ⚡ Core Modules

### 1. Ambient Ingestion Engine
* Parses raw text from Resy's standard daily 2:00 PM manager shift summary email.
* Automatically identifies party size, time slots, guest names, contact numbers, and special requests (dietary, VIP flags, booth requests).
* Includes a preloaded sample shift recap for immediate demonstration.

### 2. Active Host Triage & Service Run-Sheet
* Chronological guest ledger featuring quick action controls:
  * `CALL NEEDED`: Highlights unverified reservations so staff can confirm arrivals.
  * `CONFIRM`: Locks the table commitment.
  * `SEAT`: Marks party as actively seated and changes floor map status.
  * `CLEAR`: Frees the table for next seating turn.
  * `CANCEL`: Liberates table capacity immediately for waiting guests.

### 3. Interactive Dining Room & Patio Floor Map
* Visual representation of 14 tables (2-tops, 4-tops, 6-tops, patio tables, and bar high-tops).
* Color-coded states:
  * 🟢 **Green (Seated)**: Currently dining with active turn timer.
  * 🔵 **Blue (Reserved)**: Confirmed arrival within the next 60 minutes.
  * 🟡 **Amber (Unverified)**: At-risk booking requiring staff confirmation.
  * 🔘 **Slate (Available)**: Safe for immediate seating.

### 4. 15-Minute Kitchen Pacing Monitor
* Pacing bar chart grouped into 15-minute arrival buckets.
* Enforces a ceiling of **16 covers per 15 minutes** to prevent kitchen choke points.
* Visualizes table occupancy timeline across dinner service (5:00 PM – 10:00 PM).

### 5. Gated Online Booking Failover & SMS Gateway
* Solves the online booking dilemma:
  * Reroutes diners to a lightweight mobile booking widget (`reserve.restaurant.com/emergency`).
  * Only exposes time slots mathematically certified as free from double-booking.
  * Inbound requests hit the host dispatch queue in real time.
  * Host performs a 1-tap review and approval, triggering an automated simulated Twilio SMS pass directly to the diner's mobile phone.

### 6. Emergency Physical Clipboard Manifest
* Includes a dedicated `@media print` layout.
* One-click formatting (`Print Run-Sheet`) produces a crisp, high-contrast black-and-white clipboard sheet for service if tablet power or connectivity fails.

---

## 📱 Quick Start

This project is built with **zero external server dependencies** and runs directly in modern web browsers:

```bash
# Clone the repository
git clone git@github.com:kreator-K/Resy-Continuity-Mode.git
cd Resy-Continuity-Mode

# Open directly in your browser (macOS)
open index.html

# Or on Linux
xdg-open index.html

# Or on Windows
start index.html
```

---

## 🎯 Hackathon Presentation & Pitch Assets

For a step-by-step presentation script tailored for hackathon judges, consult:  
👉 **[`DEMO_PITCH.md`](DEMO_PITCH.md)**

---

## 📊 Key Performance Indicators (KPIs)

| Metric | Target | Operational Impact |
| :--- | :--- | :--- |
| **Double-Booking Incidents** | **0** | Protects brand trust and eliminates comped apology meals |
| **Cover Preservation Rate** | **> 92%** | Preserves core dinner service revenue ($16,000+) |
| **Incremental Walk-in Seating** | **+14 to 20 covers** | Captures $2,000+ in high-margin dinner margin |
| **Kitchen Throttle Adherence** | **≤ 16 covers / 15m** | Prevents kitchen ticket backlog and food delivery delays |
| **Time to Service Readiness** | **< 15 minutes** | Staff fully operational before doors open at 5:00 PM |

---

## 📄 License

MIT License. Designed and built for hospitality operational resilience.
