# How to re-upload FareLense to GitHub (clean)

Your old repo has the function files loose at the root, which is why
`/api/search` returns 404 and the app stays in demo mode. This package
has the correct structure: an `api/` folder for the serverless functions.

## The correct structure (already set up in this zip)

```
FareLense/
├── index.html          ← the website (root)
├── api/                ← THIS FOLDER is what fixes the 404
│   ├── search.js
│   └── airports.js
├── package.json
├── vercel.json
├── server.js
├── .gitignore
├── .env.example
├── README.md
└── SETUP.md
```

The ONLY thing that matters for the fix: `search.js` and `airports.js`
must live INSIDE the `api/` folder. Everything else is unchanged.

## Step 1 — Delete the old files on GitHub

1. Go to https://github.com/JawiTheAphaTrader/FareLense
2. For each loose file (`search.js`, `airports.js`, `index.html`,
   `package.json`, `vercel.json`, `server.js`, `README.md`, `SETUP.md`,
   `.env.example`, `.gitignore`):
   - Click the file name to open it
   - Click the trash-can icon (Delete this file) near the top right
   - Scroll down, click "Commit changes"
   (Or use the faster method in Step 2 instead.)

## Step 2 (FASTER) — Just upload over the top

You don't actually have to delete first. Uploading files with the same
name overwrites them, and adding the `api/` folder is what matters.

1. Go to https://github.com/JawiTheAphaTrader/FareLense
2. Click "Add file" → "Upload files"
3. Unzip this package on your computer
4. Drag in: index.html, package.json, vercel.json, server.js,
   .gitignore, .env.example, README.md, SETUP.md
5. THEN drag the whole `api` FOLDER in too (drag the folder itself,
   not just the files inside it) — GitHub keeps the folder structure
6. Scroll down → "Commit changes"
7. Finally, delete the OLD loose `search.js` and `airports.js` at the
   root (open each → trash icon → commit), so only the ones inside
   `api/` remain. This avoids confusion.

## Step 3 — Vercel redeploys automatically

Within ~1–2 minutes of the commit, Vercel rebuilds. Then test:

- Open https://fare-lense.vercel.app/api/search
  → should say "POST only" (NOT a 404). That means the function exists.
- Run a search on your site. With TP_TOKEN set, you get the green
  "Live fares" banner.

## Reminder: environment variables

The code fix above makes the API reachable. For LIVE prices you still
need these set in Vercel → Settings → Environment Variables (Production):

- `TP_TOKEN`   = your Travelpayouts API token
- `TP_MARKER`  = your Travelpayouts marker

After setting them, redeploy once (Deployments → ⋯ → Redeploy).
