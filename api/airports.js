/**
 * FareLense — airport / city autocomplete (Duffel Places API)
 * GET /api/airports?q=lond
 * Returns: { results: [{ code, name, city, country }] }
 * Gracefully returns [] when no DUFFEL_API_KEY is set — the frontend then
 * relies on its built-in airport database.
 */

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=86400");
  const q = (req.query?.q || "").trim();
  const key = process.env.DUFFEL_API_KEY;
  if (q.length < 2 || !key) return res.status(200).json({ results: [] });

  try {
    const r = await fetch(
      `${DUFFEL_BASE}/places/suggestions?query=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Duffel-Version": DUFFEL_VERSION,
          "Accept-Encoding": "gzip",
        },
      }
    );
    const data = await r.json();
    const results = (data.data || [])
      .filter((x) => x.iata_code)
      .slice(0, 8)
      .map((x) => ({
        code: x.iata_code,
        name: x.name,
        city: x.city_name || (x.type === "city" ? x.name : ""),
        country: x.iata_country_code || "",
        type: x.type,
      }));
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(200).json({ results: [], reason: "ERROR" });
  }
}
