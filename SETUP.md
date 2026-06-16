# FareLense — Simple Setup (one provider, 3 steps, ~10 minutes)

You only need **Travelpayouts**. Personal email, no business verification, token issued instantly. It gives you live cheapest-fare data **and** pays you commission when travelers book through your links.

---

## Step 1 — Get your free token (2 minutes)

1. Open **https://www.travelpayouts.com** → **Join for free**.
2. Sign up with your normal email (Google login also works). Choose "Website" when asked how you'll promote — paste your Vercel URL (e.g. `farelense.vercel.app`).
3. Once inside the dashboard, go to **Tools → API** (or Profile → API token).
4. Copy two values:
   - **Token** — a long string like `a1b2c3d4e5...`
   - **Marker** — a number like `654321` (this is your affiliate ID — bookings traced to it earn you commission)

## Step 2 — Add them to Vercel (2 minutes)

1. Open **vercel.com** → your FareLense project → **Settings → Environment Variables**.
2. Add two variables:

   | Name | Value |
   |---|---|
   | `TP_TOKEN` | your token |
   | `TP_MARKER` | your marker |

3. (Delete any old `AMADEUS_*` variables — they're unused now.)

## Step 3 — Redeploy (1 minute)

From the project folder on your computer:

```
vercel --prod
```

Or in the Vercel dashboard: **Deployments → ⋯ on the latest → Redeploy**.

---

## How to verify it worked

Open your site and search any route (e.g. DOH → LHR). You should see:

- 🟢 **green banner**: "Live fares · N offers · Aviasales market data" → working, done.
- 🟠 **orange banner**: "Demo mode" → the env vars aren't applied yet. Double-check the names (`TP_TOKEN`, `TP_MARKER`, exact spelling) and redeploy again — env vars only take effect on a *new* deployment.

Every "Book ✈" button on live results now opens Aviasales with your marker attached — completed bookings pay commission to your Travelpayouts account.

---

## Later, if you want richer data (optional)

Add a **Duffel** key (`DUFFEL_API_KEY`) for direct airline offers with baggage details and multi-city support. The app automatically merges both sources. But it's entirely optional — FareLense is fully functional with Travelpayouts alone.

## Notes

- Travelpayouts fares are cached market prices (refreshed up to ~48h) for one-way and round-trip searches. Multi-city searches need the Duffel provider; without it they show demo results.
- Prices shown are scaled to your traveler count; the final exact price is always confirmed on the booking page (standard for all meta-search sites).
