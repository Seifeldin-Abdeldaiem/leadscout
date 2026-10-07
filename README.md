# LeadScout

Tell LeadScout what your business sells and where you are. It returns a ranked list of nearby businesses that are likely to buy from you, with their public contact details: phone, email, website and map link. Results export to CSV.

**Live:** https://leadscout-k7q2.onrender.com *(available after the first deploy)*

## The problem

A freelance web designer in Shoreditch wants local clients, but finding them means scrolling through map apps one business at a time. LeadScout does that search in about 15 seconds. It returns cafés, shops and clinics within 1 km, puts the ones with **no website on their listing** and a phone number at the top, and pushes chains to the bottom because their buying decisions are made at head office.

## Highlights

- **Works out who your buyers are from plain English.** "Commercial cleaning" targets offices, restaurants, clinics, hotels and gyms. "IT support" targets offices, medical practices and hotels. Eleven service profiles plus a general fallback, all covered by tests.
- **Explains every score.** Each lead is scored 0–100 on distance, available contact routes, a missing website (for web and marketing sellers), opening hours, and whether it's a chain. The reasons behind each score are shown next to the lead.
- **No API keys and no cost.** Data comes from OpenStreetMap: Nominatim finds the location and Overpass finds the businesses. If an Overpass server fails, the next mirror is tried automatically.
- **Respects the free data services.** Location lookups are limited to one per second, as Nominatim's policy requires. Searches are capped at 8 per minute per visitor. Results are cached in memory for an hour, and the app identifies itself in its User-Agent.
- **Private by default.** There's no database and no account. Searches aren't stored, and logs record only counts and timings.
- **Safe CSV export.** Cells that start with `= + - @` are neutralised, so a business name can't run as a spreadsheet formula.

## Architecture

| Part | Technology |
| --- | --- |
| Web UI + API | Next.js 16 (App Router, route handlers), TypeScript, Tailwind CSS |
| Design | Neo-brutalist theme and components from [neobrutalism-components](https://github.com/ekmas/neobrutalism-components) (MIT), Space Grotesk / Space Mono, lucide icons |
| Location lookup | Nominatim (OpenStreetMap) |
| Business data | Geoapify Places API (OpenStreetMap data, free key) first; public Overpass mirrors as fallback |
| Caching / rate limiting | In-memory (`lib/limits.ts`) |
| Tests | Vitest (33 unit tests; the network is stubbed) |
| CI | GitHub Actions: lint, typecheck, test, build |
| Hosting | Render free web service, Frankfurt (`render.yaml`) |

## Repo guide

| Folder | What it is |
| --- | --- |
| `app/` | The page (`page.tsx`) and API routes (`api/leads`, `api/health`) |
| `components/` | Lead card plus neobrutalism UI components (`components/ui`) |
| `lib/` | Core logic: business→target mapping (`targets.ts`), OSM clients (`osm.ts`), scoring (`leads.ts`), search (`search.ts`), CSV export (`csv.ts`), cache and rate limiting (`limits.ts`) |
| `tests/` | Unit tests |
| `.github/workflows/` | CI |
| `render.yaml` | Deploy blueprint |

## Run it locally

Requires Node 22+.

1. `cp .env.example .env` (every setting is optional)
2. `npm ci`
3. `npm run dev`
4. Open http://localhost:3000, enter e.g. "Web design agency" and "Shoreditch, London", then click **Find leads**.

## Run the tests

- Unit tests, no network needed: `npm test`
- Everything CI runs: `npm run lint && npm run typecheck && npm test && npm run build`
- Live smoke test against real OSM data (with the app running):
  `curl -XPOST localhost:3000/api/leads -H 'content-type: application/json' -d '{"business":"cleaning","location":"Leeds","radiusKm":1}'`

## Deploy

1. Push this repo to GitHub.
2. Open `https://render.com/deploy?repo=https://github.com/<you>/leadscout`. For a private repo, first install Render's GitHub App on it.
3. Click **Apply**. Optionally (recommended) add `GEOAPIFY_API_KEY` — the free public Overpass servers are often overloaded. The first build takes about 5 minutes.
4. If Render gives the service a different URL, update `APP_URL` in `render.yaml`, or in the dashboard.

## Security and privacy

- Inputs are validated: text up to 200 characters, a radius of 0.3–5 km, and coordinates within range. User text is never placed into the Overpass query, which is built only from a fixed allow-list of tags.
- Website links from map data are only shown if they're `http(s)`, and they open with `rel="noopener noreferrer nofollow"`.
- No secrets, no database, and no stored searches. Logs contain the matched profile, the lead count and timings, but never the location or business text.
- Browser location is used only when you click **Use my location**, and only to run that search.
- **Your responsibility:** listings are public business information. Follow your local direct-marketing rules (in the UK, PECR and UK GDPR) before cold-emailing or calling.

## Roadmap

- **Free-tier limits:** the service sleeps after 15 minutes idle, so the first search afterwards waits about a minute. Caches reset whenever it sleeps.
- OpenStreetMap coverage varies by area: many businesses lack phone or email details, and some lack websites that do exist. A paid places API (e.g. Google Places) could add these behind an optional key.
- Optional AI matching for business descriptions that don't fit the keyword profiles.
- Saved lead lists and outreach status (this would need accounts and a database).
- A map view of the results.
