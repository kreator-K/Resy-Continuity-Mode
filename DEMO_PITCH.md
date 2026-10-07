# Restaurant Continuity Mode — Hackathon Showcase & Demo Guide

> **Live Prototype Path:** `file:///Users/prashant/Documents/weave/resy-continuity-mode/index.html`  
> *Double-click or open directly in any browser (Chrome, Safari, Edge) — zero installation or server required.*

---

## 1. Problem Context & Explicit Operational Assumptions

The case specifies that **Resy goes offline early in the afternoon, and dinner service is approaching**.  
To ground the incident response realistically, we define the following operational assumptions:

1. **Outage Detected at 2:00 PM (Early Afternoon)**: Resy's backend suffers a total failure. The automated 2:00 PM daily shift digest email sent to managers is the **last synchronized snapshot of ground truth**.
2. **Doors Open at 5:00 PM / First Turn at 5:30 PM**: The restaurant has a **3-hour triage runway** (2:00 PM – 5:00 PM) to assess the outage, verify bookings, and establish operating protocol before guests arrive.
3. **The 4:30 PM Pre-Shift Milestone**: At 4:30 PM (30 minutes prior to doors open), the GM runs pre-shift staff lineup, locks the manifest, prints emergency paper clipboards, and exposes safe second-turn slots on the online emergency booking portal.
4. **Live Service Simulation (5:45 PM Clock)**: The interactive prototype simulates service at 5:45 PM—in the middle of the first seating rush—to demonstrate live table management, kitchen pacing, walk-ins, and online request dispatch.

---

## 2. 30-Second Elevator Pitch for Judges

> *"It’s 2:00 PM on a Friday. Resy has just gone dark nationwide. Your restaurant has 140 covers booked for dinner tonight, representing $18,000 in revenue. Doors open in 3 hours.*  
> 
> *Most restaurants face two bad choices: either shut off all new bookings and bleed high-margin revenue, or accept walk-ins and web forms blindly and face catastrophic double-bookings.*  
> 
> *We built **Restaurant Continuity Mode**: an incident-response operating system that reconstructs tonight's book from the 2:00 PM email digest, gives staff a structured triage workflow, protects kitchen pacing, and provides a **gated failover online booking portal** that allows guests to reserve open tables with a 100% guarantee against double-booking."*

---

## 3. How Continuity Mode Solves the "Online Booking Issue"

When Resy crashes, online booking presents a dangerous catch-22:
1. **The Diner Failure**: Anyone clicking "Reserve" on the restaurant's website, Instagram link, or Google Maps gets an error.
2. **The Double-Booking Danger**: If a restaurant throws up an uncoordinated Google Form or OpenTable link, they will inevitably sell Table 4 to an online diner while someone with a pre-existing Resy booking is walking in the door.

### The 3-Layer Solution:
* **Layer 1: DNS / Link Failover (`lamibistro.com/reserve-continuity`)**:  
  The restaurant's website "Book Now" link automatically reroutes to the lightweight Continuity Booking Widget.
* **Layer 2: Algorithmic Gating (Only Certified Safe Inventory Exposed)**:  
  The online portal does **not** expose full inventory. It mathematically evaluates table turn-times (90 min for 2-tops, 120 min for 4-tops) against the recovered Resy book. Prime crunch times (e.g. 6:30–7:30 PM) are automatically greyed out. Only verified, conflict-free slots (e.g., Table 9 at 8:15 PM) are exposed.
* **Layer 3: Two-Way SMS Triage Handshake (Zero Double-Booking Guarantee)**:  
  Online submissions land instantly in the **Host Stand Dispatch Queue**. The host taps **"One-Tap Approve"**, automatically assigning the table and triggering a confirmation SMS to the diner's phone.

---

## 4. Live 3-Minute Hackathon Demo Script

### Step 1: The Outage & Ingestion (Tab 5: Ingest Backup Data)
* **Action:** Go to **"Ingest Backup Data"**. Click **"Load Sample 2:00 PM Email"** then **"Parse & Reconstruct Book"**.
* **Talking Point:** *"When platform APIs crash, we extract ambient operational exhaust. Resy sends a 2:00 PM daily Shift Digest email to managers. Our parser instantly reconstructs 16 reservations and 58 covers."*

### Step 2: The Host Stand Run-Sheet & Triage (Tab 1: Host Run-Sheet)
* **Action:** Show the manifest. Point out amber `CALL NEEDED` badges. Click **"✓ Confirm"** on Hannah Wright.
* **Talking Point:** *"Between 2:30 PM and 4:30 PM, the host team executes phone triage: calling unverified guests while they are still at their desks. This cleans the book and frees up uncommitted tables."*

### Step 3: THE ONLINE BOOKING DEMO (Tab 4: Online Diner Portal)
* **Action:** Switch to **"Online Diner Portal"**. Click **"⚡ Simulate Diner Request"**.
* **Talking Point:** *"Now, watch how we solve the online booking problem. On the left is the mobile widget a diner sees on their phone during the outage. Notice that slots during peak rush are disabled to protect kitchen pacing, but 8:15 PM is certified safe.*  
* **Action:** Click **"Request Reservation"** on the simulated phone.
* **Talking Point:** *"Watch the right panel: the host stand immediately receives an inbound notification with smart table assignment (Table 9) and kitchen pacing validation.*  
* **Action:** Click **"One-Tap Approve & Send SMS Pass"**.
* **Talking Point:** *"The host approves in one tap. Notice the simulated Twilio SMS gateway dispatching an instant confirmation SMS to the diner, and Table 9 is now locked in the live manifest and floor plan."*

### Step 4: Visual Floor Map & Walk-ins (Tab 2: Floor Map)
* **Action:** Show Table 1 (Green/Seated) and the newly locked Table 9.
* **Talking Point:** *"The front-of-house has total visual clarity. If a walk-in arrives at the door, the 'Seat Walk-In' engine runs the same conflict-free turn-time math."*

### Step 5: Kitchen Pacing & Paper Fallback (Tab 3 & Header)
* **Action:** Show the 15-min bar chart and click **"Print Run-Sheet"**.
* **Talking Point:** *"We cap kitchen arrivals at 16 covers per 15 minutes. And if the iPad battery dies or power drops, one click formats an emergency clipboard manifest."*

---

## 5. Key Metrics & Judge Takeaways

| Metric | Target | Business Impact |
| :--- | :--- | :--- |
| **Double-Booking Rate** | **0%** | Guaranteed by algorithmic turn-time gating & host handshake |
| **Online Demand Captured** | **12–20 Covers** | Recovers $1,800–$2,600 in Friday dinner revenue |
| **Host Response Time** | **< 60 seconds** | One-tap triage keeps host focused on hospitality |
| **Kitchen Crash Incidents** | **0** | Enforced 16 covers/15m throttle |
