# Resy Continuity Mode

> **Offline-First Incident-Response & Reservation Floor Management for Restaurants during Platform Outages**

When platforms like Resy go dark right before prime dinner service, restaurants face an operational crisis: hosts lose visibility into who is coming, tables sit empty out of fear of double-booking, and high-margin walk-in demand is turned away.

**Resy Continuity Mode** is a zero-dependency, browser-based emergency floor manager designed for host tablets and GM laptops. It reconstructs the dining room's book from ambient operational data, safeguards kitchen pacing, and provides a safe, failover online booking channel.

---

## 🚀 Live Demo & Quick Start

1. Clone or download this repository.
2. Open `index.html` directly in any web browser (Chrome, Safari, Firefox, Edge).
   * **No `npm install`**, no Node.js server, and no database required.
   * Completely offline-first with local persistence (`localStorage`).

---

## 🛠️ Key Capabilities

### 1. Ambient Data Recovery (Shift Digest Ingestion)
* Ingests and parses raw text from Resy's automated daily 2:00 PM shift recap emails.
* Instantly extracts guest names, party sizes, contact numbers, dietary restrictions, and table pre-assignments.

### 2. Host Stand Run-Sheet & Triage
* Chronological guest manifest with real-time status tracking (`Call Needed`, `Confirmed`, `Seated`, `Cleared`).
* One-click click-to-call links for front-of-house staff to verify incoming parties and filter out no-shows.

### 3. Conflict-Free Walk-In & Table Engine
* Calculates party-based turn times (90 mins for 2-tops, 120 mins for 4-tops + 15m kitchen buffer).
* Automatically checks remaining table capacity and prevents double-booking against existing reservations.

### 4. Kitchen Pacing Governor
* 15-minute slot visualization capping arrivals at 16 covers per window to prevent kitchen crashes.

### 5. Gated Online Booking Failover
* Reroutes diners to a lightweight mobile booking widget.
* Algorithmic inventory gating exposes only verified open slots (peak rush windows are waitlisted).
* Two-way host triage with automated simulated SMS confirmations sent to diners upon one-tap approval.

### 6. Emergency Clipboard Run-Sheet
* One-click print-optimized manifest (`Ctrl+P` / `Cmd+P`) formatted for physical clipboards if tablet battery or power drops.

---

## 📋 Hackathon Presentation & Pitch Assets

* See [`DEMO_PITCH.md`](DEMO_PITCH.md) for the complete 3-minute judge walkthrough, hook, talking points, and economic impact model.
