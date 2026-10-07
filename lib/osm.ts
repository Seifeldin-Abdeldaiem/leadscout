import type { TagFilter } from "./targets";

export const USER_AGENT = `LeadScout/1.0 (+${process.env.APP_URL || "https://github.com/leadscout"})`;

const DEFAULT_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function overpassEndpoints(): string[] {
  const fromEnv = (process.env.OVERPASS_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_OVERPASS;
}

/** Only allow tag keys/values made of safe characters, so user input can never reach the query. */
const SAFE = /^[a-z0-9_:]+$/;

export function buildOverpassQuery(
  filters: TagFilter[],
  lat: number,
  lon: number,
  radiusM: number,
  limit = 400,
): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusM)) {
    throw new Error("invalid coordinates");
  }
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  const parts = filters.map((f) => {
    if (!SAFE.test(f.key) || (f.values && !f.values.every((v) => SAFE.test(v)))) {
      throw new Error(`unsafe tag filter: ${f.key}`);
    }
    const tag = f.values ? `["${f.key}"~"^(${f.values.join("|")})$"]` : `["${f.key}"]`;
    return `  nwr${tag}["name"]${around};`;
  });
  return `[out:json][timeout:25];\n(\n${parts.join("\n")}\n);\nout center tags ${limit};`;
}

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Run a query against each Overpass mirror in turn until one answers. */
export async function runOverpass(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OsmElement[]> {
  const errors: string[] = [];
  for (const url of overpassEndpoints()) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": USER_AGENT,
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        errors.push(`${new URL(url).host}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).name}`);
    }
  }
  throw new Error(`All map data servers failed (${errors.join("; ")})`);
}

export type Place = { lat: number; lon: number; label: string };

// Nominatim's usage policy allows at most 1 request per second.
let nominatimChain: Promise<unknown> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimChain.then(fn, fn);
  nominatimChain = run.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100)),
  );
  return run;
}

export async function geocode(q: string, fetchImpl: typeof fetch = fetch): Promise<Place | null> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "1",
  })}`;
  const rows = await throttled(async () => {
    const res = await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, "accept-language": "en" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`geocoder HTTP ${res.status}`);
    return (await res.json()) as { lat: string; lon: string; display_name: string }[];
  });
  if (!rows.length) return null;
  return { lat: Number(rows[0].lat), lon: Number(rows[0].lon), label: rows[0].display_name };
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "14",
  })}`;
  try {
    const row = await throttled(async () => {
      const res = await fetchImpl(url, {
        headers: { "user-agent": USER_AGENT, "accept-language": "en" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { display_name?: string };
    });
    return row.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}
