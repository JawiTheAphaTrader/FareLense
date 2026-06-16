/**
 * FareLense — live flight search (Vercel serverless function)
 *
 * Providers (either or both — results are merged):
 *   1. DUFFEL        — live airline offers (NDC + GDS). Free test mode, instant signup.
 *                      Env: DUFFEL_API_KEY  (duffel_test_... or duffel_live_...)
 *   2. TRAVELPAYOUTS — cheapest cached market fares + affiliate booking links.
 *                      Env: TP_TOKEN (API token), TP_MARKER (affiliate marker, optional)
 *
 * POST /api/search
 * Body: {
 *   trip: "oneway" | "round" | "multi",
 *   from: "DOH", to: "LHR",
 *   depart: "2026-07-01", return: "2026-07-10",
 *   segments: [{from,to,date}, ...],          // multi-city
 *   adults: 1, children: 0,                    // children priced as age 10
 *   nonStop: false, currency: "USD", max: 30
 * }
 */

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";
const TP_BASE = "https://api.travelpayouts.com";

const isoToMin = (iso) => {
  if (!iso) return 0;
  const d = /(\d+)D/.exec(iso)?.[1] || 0;
  const h = /(\d+)H/.exec(iso)?.[1] || 0;
  const m = /(\d+)M/.exec(iso)?.[1] || 0;
  return (+d) * 1440 + (+h) * 60 + (+m);
};
const minutesBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

/* ============================== DUFFEL ============================== */

async function duffelSearch(q) {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) return null;

  const slices =
    q.trip === "multi"
      ? q.segments.map((s) => ({ origin: s.from, destination: s.to, departure_date: s.date }))
      : [
          { origin: q.from, destination: q.to, departure_date: q.depart },
          ...(q.return ? [{ origin: q.to, destination: q.from, departure_date: q.return }] : []),
        ];

  const passengers = [
    ...Array.from({ length: q.adults || 1 }, () => ({ type: "adult" })),
    ...Array.from({ length: q.children || 0 }, () => ({ age: 10 })),
  ];

  const body = {
    data: {
      slices,
      passengers,
      cabin_class: "economy",
      ...(q.nonStop ? { max_connections: 0 } : {}),
    },
  };

  const res = await fetch(
    `${DUFFEL_BASE}/air/offer_requests?return_offers=true&supplier_timeout=15000`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Duffel-Version": DUFFEL_VERSION,
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const detail =
      data?.errors?.[0]?.message || data?.errors?.[0]?.title || `Duffel HTTP ${res.status}`;
    const err = new Error(detail);
    err.code = "DUFFEL_FAILED";
    err.status = res.status;
    throw err;
  }
  const offers = data.data?.offers || [];
  return offers.map(mapDuffelOffer).filter(Boolean);
}

function mapDuffelOffer(o) {
  try {
    const slices = o.slices || [];
    if (!slices.length) return null;

    const itineraries = slices.map((sl) => {
      const segs = sl.segments || [];
      const first = segs[0], last = segs[segs.length - 1];
      return {
        from: sl.origin?.iata_code || first?.origin?.iata_code,
        to: sl.destination?.iata_code || last?.destination?.iata_code,
        depTime: first?.departing_at,
        arrTime: last?.arriving_at,
        durationMin: sl.duration
          ? isoToMin(sl.duration)
          : minutesBetween(first?.departing_at, last?.arriving_at),
        stops: Math.max(segs.length - 1, 0),
        stopAirports: segs.slice(0, -1).map((s) => s.destination?.iata_code),
        segments: segs.map((s) => ({
          carrier: s.marketing_carrier?.iata_code,
          flight: `${s.marketing_carrier?.iata_code || ""}${s.marketing_carrier_flight_number || ""}`,
          from: s.origin?.iata_code,
          to: s.destination?.iata_code,
          dep: s.departing_at,
          arr: s.arriving_at,
        })),
      };
    });

    // baggage from first segment's first passenger
    let checkedBags = 0, cabinBags = 0;
    try {
      const bags = slices[0].segments[0].passengers?.[0]?.baggages || [];
      for (const b of bags) {
        if (b.type === "checked") checkedBags += b.quantity || 0;
        if (b.type === "carry_on") cabinBags += b.quantity || 0;
      }
    } catch { /* defaults */ }

    const out0 = itineraries[0];
    return {
      id: o.id,
      provider: "duffel",
      price: Number(o.total_amount),
      currency: o.total_currency,
      airline: o.owner?.iata_code || "??",
      airlineName: o.owner?.name || o.owner?.iata_code || "Airline",
      checkedBags,
      cabinBags,
      seatsLeft: null,
      itineraries,
      from: out0.from,
      to: out0.to,
      depTime: out0.depTime,
      arrTime: out0.arrTime,
      durationMin: out0.durationMin,
      stops: out0.stops,
      bookUrl: null, // redirect handled by frontend deep links
    };
  } catch {
    return null;
  }
}

/* ============================ TRAVELPAYOUTS ============================ */

async function tpSearch(q) {
  const token = process.env.TP_TOKEN;
  if (!token || q.trip === "multi") return null; // TP v3 covers one-way & round-trip

  const params = new URLSearchParams({
    origin: q.from,
    destination: q.to,
    departure_at: q.depart,
    currency: (q.currency || "USD").toLowerCase(),
    sorting: "price",
    direct: q.nonStop ? "true" : "false",
    limit: String(Math.min(q.max || 30, 30)),
    one_way: q.return ? "false" : "true",
    token,
  });
  if (q.return) params.set("return_at", q.return);

  const res = await fetch(`${TP_BASE}/aviasales/v3/prices_for_dates?${params}`);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const err = new Error(data?.error || `Travelpayouts HTTP ${res.status}`);
    err.code = "TP_FAILED";
    throw err;
  }
  const marker = process.env.TP_MARKER;
  const cur = (data.currency || q.currency || "USD").toUpperCase();

  return (data.data || []).map((x) => {
    const durOut = x.duration_to || x.duration || 0;
    const dep = x.departure_at;
    const arr = dep ? new Date(new Date(dep).getTime() + durOut * 60000).toISOString() : null;
    let link = x.link ? `https://www.aviasales.com${x.link}` : null;
    if (link && marker) link += (link.includes("?") ? "&" : "?") + `marker=${marker}`;
    return {
      id: `tp_${x.flight_number || ""}_${dep || ""}`,
      provider: "travelpayouts",
      price: Number(x.price),
      currency: cur,
      airline: x.airline || "??",
      airlineName: x.airline || "Airline",
      checkedBags: 0,
      cabinBags: null,
      seatsLeft: null,
      itineraries: null,
      from: x.origin || q.from,
      to: x.destination || q.to,
      depTime: dep,
      arrTime: arr,
      durationMin: x.duration || durOut || 0,
      stops: x.transfers ?? 0,
      bookUrl: link,
      // NOTE: TP prices are per adult, cached market fares
      perAdult: true,
    };
  });
}

/* ============================== HANDLER ============================== */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let q;
  try {
    q = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const iata = (v) => typeof v === "string" && /^[A-Z]{3}$/i.test(v);
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

  if (q.trip === "multi") {
    if (!Array.isArray(q.segments) || q.segments.length < 2)
      return res.status(400).json({ error: "Multi-city needs at least 2 segments" });
    for (const s of q.segments) {
      if (!iata(s.from) || !iata(s.to) || !isDate(s.date))
        return res.status(400).json({ error: "Each segment needs from/to (IATA) and date (YYYY-MM-DD)" });
      s.from = s.from.toUpperCase();
      s.to = s.to.toUpperCase();
    }
  } else {
    if (!iata(q.from) || !iata(q.to))
      return res.status(400).json({ error: "from/to must be 3-letter IATA codes, e.g. DOH" });
    if (!isDate(q.depart)) return res.status(400).json({ error: "depart must be YYYY-MM-DD" });
    if (q.trip === "round" && !isDate(q.return))
      return res.status(400).json({ error: "return must be YYYY-MM-DD for round trips" });
    q.from = q.from.toUpperCase();
    q.to = q.to.toUpperCase();
    if (q.trip !== "round") delete q.return;
  }
  q.adults = Math.min(Math.max(parseInt(q.adults) || 1, 1), 9);
  q.children = Math.min(Math.max(parseInt(q.children) || 0, 0), 8);

  const hasDuffel = !!process.env.DUFFEL_API_KEY;
  const hasTP = !!process.env.TP_TOKEN;
  if (!hasDuffel && !hasTP) {
    return res.status(200).json({ live: false, reason: "NO_CREDENTIALS", offers: [] });
  }

  const errors = [];
  const [duffelRes, tpRes] = await Promise.allSettled([duffelSearch(q), tpSearch(q)]);

  let offers = [];
  const sources = [];
  if (duffelRes.status === "fulfilled" && duffelRes.value) {
    offers = offers.concat(duffelRes.value);
    sources.push(process.env.DUFFEL_API_KEY?.startsWith("duffel_live") ? "Duffel (live)" : "Duffel (test)");
  } else if (duffelRes.status === "rejected" && hasDuffel) {
    errors.push(String(duffelRes.reason?.message || duffelRes.reason).slice(0, 200));
  }
  if (tpRes.status === "fulfilled" && tpRes.value) {
    // TP prices are per adult — scale to total travelers for fair comparison
    const paxFactor = q.adults + q.children;
    offers = offers.concat(
      tpRes.value.map((o) => ({ ...o, price: Math.round(o.price * paxFactor * 100) / 100 }))
    );
    sources.push("Aviasales market data");
  } else if (tpRes.status === "rejected" && hasTP) {
    errors.push(String(tpRes.reason?.message || tpRes.reason).slice(0, 200));
  }

  if (!offers.length) {
    return res.status(502).json({
      live: false,
      reason: "PROVIDERS_FAILED",
      error: errors.join(" | ") || "No offers returned for this route/date",
    });
  }

  offers.sort((a, b) => a.price - b.price);
  return res.status(200).json({
    live: true,
    sources,
    count: offers.length,
    currency: offers[0]?.currency || q.currency || "USD",
    offers: offers.slice(0, 60),
    warnings: errors.length ? errors : undefined,
  });
}
