# ✈ FareLense — Find the Best Fare, Every Time

A full-stack flight fare search app. Travelers search one-way, round-trip or multi-city routes; FareLense pulls **live fares** from airline inventory (Duffel API) and market data (Travelpayouts/Aviasales), highlights the cheapest options with baggage-aware filtering, flexible dates and nearby airports — then **redirects travelers to booking sites** (Google Flights, Skyscanner, Momondo, Wego, Kayak) to complete the purchase.

## How it works

```
Browser (index.html)
   │  POST /api/search        ── one-way / round-trip / multi-city payload
   ▼
Vercel serverless (api/search.js)
   │  Duffel Offer Requests + Travelpayouts prices-for-dates (parallel)
   ▼
Live offers (price, airline, times, stops, included baggage, seats left)
   │
   ▼
Frontend ranks Best / Cheapest / Fastest, applies filters,
"Book ✈" buttons redirect to booking sites pre-filled with the flight
```

If no API keys are configured, the app automatically runs in **demo mode** with simulated fares and a visible banner — so you can preview the UI before signing up.

## 1. Get API keys (Duffel + optional Travelpayouts)

> Amadeus Self-Service was decommissioned on July 17, 2026 — FareLense now uses Duffel as the primary live-fare provider, with optional Travelpayouts for affiliate-monetized booking links.

**Duffel (primary — live airline offers):**
1. Sign up free at **https://duffel.com** (instant, self-service).
2. Dashboard → **Developers → Access tokens** → create a **test** token (`duffel_test_...`).
3. Test mode is free and returns realistic sandbox offers — perfect for building. When ready, activate **live mode** for real airline fares: pay-as-you-go, zero upfront cost.

**Travelpayouts (optional — cheapest market fares + commission for you):**
1. Sign up free at **https://www.travelpayouts.com** (affiliate network for Aviasales/WayAway and 100+ travel brands).
2. Copy your **API token** and **marker** (your affiliate ID) from Tools → API.
3. With these set, FareLense merges Aviasales' cheapest cached fares into results, and those "Book ✈" buttons carry your affiliate marker — you earn commission on completed bookings.

Either provider alone works; both together give the richest results.

## 2. Run locally

```bash
cp .env.example .env        # paste your API Key / Secret into .env
npm run dev                 # → http://localhost:3000
```

No npm dependencies — plain Node 18+.

## 3. Deploy to Vercel

```bash
npm i -g vercel
vercel                      # from the project folder
```

Then in the Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `DUFFEL_API_KEY` | `duffel_test_...` or `duffel_live_...` |
| `TP_TOKEN` | (optional) Travelpayouts API token |
| `TP_MARKER` | (optional) Travelpayouts affiliate marker |

Redeploy (`vercel --prod`). The `/api` folder is auto-detected as serverless functions; `index.html` is served statically. Done — live prices on your own URL.

## 4. Going to production (real market fares)

Switch your Duffel token from `duffel_test_...` to `duffel_live_...` (activate live mode in the Duffel dashboard — pay-as-you-go, no contract). No code changes; the app detects the token type automatically.

## 5. Monetizing the redirects — already built in

Set `TP_TOKEN` + `TP_MARKER` and every Aviasales-sourced "Book ✈" button carries your affiliate marker, earning commission on completed bookings. Duffel-sourced offers redirect to Google Flights pre-filled with the flight; later you can use Duffel's booking API to keep the entire booking (and margin) inside FareLense.

## Features checklist

- One-way / round-trip / multi-city (up to 5 legs)
- Specific dates or flexible range (±1/±3/±7 days, whole month) — searched as parallel live queries, merged & de-duplicated
- Baggage modes: no bags / cabin only / checked bag (live results show *included* checked baggage from the fare data)
- Travelers: adults (14+) and children (0–14) — children are priced at a representative age of 10 via Duffel's per-age passenger model
- Stops: direct / 1 / 2 / 2+ (direct uses Duffel's max_connections=0; others filtered client-side)
- Nearby airports: expands the search to common alternates (LHR↔LGW/STN, DXB↔SHJ/AUH, JFK↔EWR…) — edit the `NEARBY` map in `index.html` to add more
- Instant airport autocomplete (built-in 130+ airport DB) enriched by Duffel's worldwide Places API
- Results: Best / Cheapest / Fastest sorting + filters for max price, max duration, stops, airline
- Booking redirects to Google Flights, Skyscanner, Momondo, Wego, Kayak
- Animated aeroplane sky, FareLense branding & logo, light funky theme

## Notes & limits

- **Duffel test mode** returns sandbox offers (including the fictional "Duffel Airways") — switch to a live token for real airline fares.
- The app fires up to **6 live queries per search** (flexible dates + nearby airports) to stay well within provider rate limits.
- Prices shown are the **total for all travelers** in the selected currency (USD by default — change `currency` in `buildQueries()`).
- Scraping Google Flights/Skyscanner directly is blocked by those sites; the compliant architecture is exactly this one: licensed fare APIs (Duffel, Travelpayouts) for prices + outbound/affiliate links for booking.
