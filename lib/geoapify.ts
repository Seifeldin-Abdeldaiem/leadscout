import type { OsmElement } from "./osm";
import type { TagFilter } from "./targets";

/**
 * Geoapify Places API: hosted, rate-limit-friendly access to the same
 * OpenStreetMap business data. Used first when GEOAPIFY_API_KEY is set,
 * because the free public Overpass servers are often overloaded.
 * Free plan: 3,000 credits/day, no card, commercial use allowed with attribution.
 */

const AMENITY_TO_CATEGORY: Record<string, string> = {
  restaurant: "catering.restaurant",
  cafe: "catering.cafe",
  bar: "catering.bar",
  pub: "catering.pub",
  fast_food: "catering.fast_food",
  dentist: "healthcare",
  doctors: "healthcare",
  clinic: "healthcare",
  pharmacy: "healthcare.pharmacy",
};

const SHOP_TO_CATEGORY: Record<string, string> = {
  supermarket: "commercial.supermarket",
  convenience: "commercial.convenience",
};

/** Translate our OSM tag filters into Geoapify categories (unknown ones are skipped). */
export function geoapifyCategories(filters: TagFilter[]): string[] {
  const out = new Set<string>();
  for (const f of filters) {
    if (f.key === "amenity") {
      for (const v of f.values ?? []) if (AMENITY_TO_CATEGORY[v]) out.add(AMENITY_TO_CATEGORY[v]);
    } else if (f.key === "shop") {
      if (!f.values) out.add("commercial");
      else for (const v of f.values) out.add(SHOP_TO_CATEGORY[v] ?? "commercial");
    } else if (f.key === "office") {
      out.add("office");
    } else if (f.key === "tourism") {
      out.add("accommodation");
    }
  }
  // "commercial" already covers its sub-categories
  if (out.has("commercial")) for (const c of [...out]) if (c.startsWith("commercial.")) out.delete(c);
  return [...out];
}

type GeoFeature = {
  properties: {
    name?: string | number;
    lat: number;
    lon: number;
    place_id?: string;
    categories?: string[];
    street?: string;
    housenumber?: string;
    city?: string;
    suburb?: string;
    postcode?: string;
    website?: string;
    opening_hours?: string;
    brand?: string;
    contact?: { phone?: string; email?: string };
    datasource?: { sourcename?: string; raw?: Record<string, string | number> };
  };
};

const OSM_TYPES: Record<string, OsmElement["type"]> = { n: "node", w: "way", r: "relation", node: "node", way: "way", relation: "relation" };

/** Convert a Geoapify feature into the OSM-shaped element the ranking code expects. */
export function featureToElement(f: GeoFeature, index: number): OsmElement | null {
  const p = f.properties;
  if (p?.name == null || p.name === "" || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  const raw = p.datasource?.raw ?? {};
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" || typeof v === "number") tags[k] = String(v);
  tags.name = String(p.name); // Geoapify returns numeric names (e.g. "1761") as numbers
  if (p.website && !tags.website) tags.website = p.website;
  if (p.contact?.phone && !tags.phone) tags.phone = p.contact.phone;
  if (p.contact?.email && !tags.email) tags.email = p.contact.email;
  if (p.opening_hours && !tags.opening_hours) tags.opening_hours = p.opening_hours;
  if (p.brand && !tags.brand) tags.brand = p.brand;
  if (p.street && !tags["addr:street"]) tags["addr:street"] = p.street;
  if (p.housenumber && !tags["addr:housenumber"]) tags["addr:housenumber"] = p.housenumber;
  if (p.city && !tags["addr:city"]) tags["addr:city"] = p.city;
  if (p.postcode && !tags["addr:postcode"]) tags["addr:postcode"] = p.postcode;
  // If there were no raw OSM tags, derive a category from Geoapify's own one.
  if (!["amenity", "shop", "office", "craft", "tourism", "leisure", "healthcare"].some((k) => tags[k])) {
    const cat = (p.categories ?? []).slice().sort((a, b) => b.split(".").length - a.split(".").length)[0];
    if (cat) tags.amenity = cat.split(".").pop()!;
  }
  const osmType = OSM_TYPES[String(raw.osm_type ?? "")];
  const osmId = Number(raw.osm_id);
  return {
    type: osmType ?? "node",
    id: osmType && Number.isFinite(osmId) ? Math.abs(osmId) : -(index + 1),
    lat: p.lat,
    lon: p.lon,
    tags,
  };
}

export async function runGeoapify(
  filters: TagFilter[],
  lat: number,
  lon: number,
  radiusM: number,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OsmElement[]> {
  const categories = geoapifyCategories(filters);
  if (!categories.length) throw new Error("no Geoapify categories for this profile");
  const url = `https://api.geoapify.com/v2/places?${new URLSearchParams({
    categories: categories.join(","),
    filter: `circle:${lon.toFixed(6)},${lat.toFixed(6)},${Math.round(radiusM)}`,
    bias: `proximity:${lon.toFixed(6)},${lat.toFixed(6)}`,
    limit: "300",
    apiKey,
  })}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Geoapify HTTP ${res.status}`);
  const json = (await res.json()) as { features?: GeoFeature[] };
  return (json.features ?? [])
    .map((f, i) => featureToElement(f, i))
    .filter((e): e is OsmElement => e !== null);
}
