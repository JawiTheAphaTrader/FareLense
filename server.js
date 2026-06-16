/**
 * FareLense — local development server
 * Mirrors Vercel's behavior: serves index.html and routes /api/* to the
 * serverless handlers in /api. Run with:  npm run dev
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// load .env if present (no dependency needed)
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const searchHandler = (await import("./api/search.js")).default;
const airportsHandler = (await import("./api/airports.js")).default;

function wrapRes(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };
  return res;
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  wrapRes(res);

  if (u.pathname === "/api/search") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      req.body = body;
      try { await searchHandler(req, res); }
      catch (e) { res.status(500).json({ error: String(e) }); }
    });
    return;
  }
  if (u.pathname === "/api/airports") {
    req.query = Object.fromEntries(u.searchParams);
    try { await airportsHandler(req, res); }
    catch (e) { res.status(500).json({ error: String(e) }); }
    return;
  }
  // static
  const file = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
  const fp = path.join(__dirname, file);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const ext = path.extname(fp);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    fs.createReadStream(fp).pipe(res);
  } else {
    res.status(404).end("Not found");
  }
}).listen(PORT, () => console.log(`✈  FareLense dev server → http://localhost:${PORT}`));
