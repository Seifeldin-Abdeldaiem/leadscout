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

/** Bounding box (south,west,north,east) that contains a circle of radiusM around the point. */
export function bboxAround(lat: number, lon: number, radiusM: number): string {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((n) => n.toFixed(5)).join(",");
}

/**
 * Build the Overpass query. Uses a bounding box (index-backed, several times
 * faster than `around:` on busy city centres) and nodes + ways only; results
 * outside the radius are dropped later when leads are ranked.
 */
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
  const bbox = bboxAround(lat, lon, radiusM);
  const parts = filters.map((f) => {
    if (!SAFE.test(f.key) || (f.values && !f.values.every((v) => SAFE.test(v)))) {
      throw new Error(`unsafe tag filter: ${f.key}`);
    }
    const tag = f.values ? `["${f.key}"~"^(${f.values.join("|")})$"]` : `["${f.key}"]`;
    return `  nw${tag}["name"];`;
  });
  return `[out:json][timeout:40][bbox:${bbox}];\n(\n${parts.join("\n")}\n);\nout center tags ${limit};`;
}

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** How long to wait for a mirror before also asking the next one. */
export const HEDGE_DELAY_MS = 6_000;
const PER_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Ask the Overpass mirrors for the data, "hedged": start with the first mirror,
 * and if it hasn't answered within HEDGE_DELAY_MS (or fails sooner), also ask the
 * next one. The first good answer wins and the others are cancelled. Public
 * mirrors are often overloaded, so this keeps searches fast without hammering
 * every server on every request.
 */
export async function runOverpass(
  query: string,
  fetchImpl: typeof fetch = fetch,
  hedgeDelayMs = HEDGE_DELAY_MS,
): Promise<OsmElement[]> {
  const urls = overpassEndpoints();
  const controllers = urls.map(() => new AbortController());
  const errors: string[] = [];

  return new Promise<OsmElement[]>((resolve, reject) => {
    let settled = false;
    let started = 0;
    let finished = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (ok: boolean, value: OsmElement[] | Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      controllers.forEach((c) => c.abort());
      if (ok) resolve(value as OsmElement[]);
      else reject(value);
    };

    const startNext = () => {
      if (settled || started >= urls.length) return;
      const i = started++;
      if (timer) clearTimeout(timer);
      if (started < urls.length) timer = setTimeout(startNext, hedgeDelayMs);
      const url = urls[i];
      const host = new URL(url).host;
      const timeout = setTimeout(() => controllers[i].abort(), PER_REQUEST_TIMEOUT_MS);
      fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controllers[i].signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
          // Overpass reports server-side timeouts as 200 + "remark" with no elements.
          if (!json.elements?.length && json.remark) throw new Error(`remark: ${json.remark.slice(0, 80)}`);
          finish(true, json.elements ?? []);
        })
        .catch((e: Error) => {
          errors.push(`${host}: ${e.message || e.name}`);
          finished++;
          if (finished >= urls.length) {
            finish(false, new Error(`All map data servers failed (${errors.join("; ")})`));
          } else {
            startNext(); // fail fast: don't wait for the hedge timer
          }
        })
        .finally(() => clearTimeout(timeout));
    };

    startNext();
  });
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
