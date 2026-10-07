import type { OsmElement } from "./osm";
import type { Profile } from "./targets";

export type Lead = {
  id: string;
  name: string;
  category: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  distanceM: number;
  lat: number;
  lon: number;
  osmUrl: string;
  score: number;
  reasons: string[];
};

export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const pretty = (s: string) => s.replace(/_/g, " ");

export function categoryOf(tags: Record<string, string>): string {
  for (const key of ["amenity", "shop", "office", "craft", "tourism", "leisure", "healthcare"]) {
    const v = tags[key];
    if (!v) continue;
    if (v === "yes") return pretty(key);
    return key === "amenity" || key === "tourism" || key === "leisure" ? pretty(v) : `${pretty(v)} (${key})`;
  }
  return "business";
}

function addressOf(t: Record<string, string>): string {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  return [street, t["addr:city"] || t["addr:suburb"], t["addr:postcode"]].filter(Boolean).join(", ");
}

/** Accept only http(s) website values; prefix bare domains. */
export function cleanWebsite(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.split(";")[0].trim();
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function toLead(
  el: OsmElement,
  origin: { lat: number; lon: number },
  radiusM: number,
  profile: Profile,
): Lead | null {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!t.name || lat === undefined || lon === undefined) return null;

  const phone = t.phone || t["contact:phone"] || t["contact:mobile"];
  const email = t.email || t["contact:email"];
  const website = cleanWebsite(t.website || t["contact:website"] || t.url);
  const distanceM = Math.round(haversineM(origin.lat, origin.lon, lat, lon));

  let score = 40;
  const reasons: string[] = [];
  const closeness = Math.max(0, 1 - distanceM / radiusM);
  score += Math.round(20 * closeness);
  if (closeness > 0.6) reasons.push("Very close to you");

  if (profile.missingWebsiteIsOpportunity) {
    if (!website) {
      score += 25;
      reasons.push("No website on its listing — check, then pitch a new site");
    } else {
      reasons.push("Has a website — pitch a redesign, SEO or ads");
    }
  } else if (website) {
    score += 5;
  }
  if (phone) {
    score += 10;
    reasons.push("Phone number available");
  }
  if (email) {
    score += 10;
    reasons.push("Email available");
  }
  if (t.opening_hours) score += 5;
  if (t.brand || t["brand:wikidata"]) {
    score -= 30;
    reasons.push("Part of a chain — buying is likely done centrally");
  }
  if (!phone && !email && !website) reasons.push("Visit in person — no online contact listed");

  return {
    id: `${el.type}/${el.id}`,
    name: t.name,
    category: categoryOf(t),
    address: addressOf(t),
    phone,
    email,
    website,
    distanceM,
    lat,
    lon,
    osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

export function rankLeads(
  elements: OsmElement[],
  origin: { lat: number; lon: number },
  radiusM: number,
  profile: Profile,
  max = 100,
): Lead[] {
  const seen = new Set<string>();
  const leads: Lead[] = [];
  for (const el of elements) {
    const lead = toLead(el, origin, radiusM, profile);
    if (!lead) continue;
    // the same business is often mapped twice (node + building)
    const key = `${lead.name.toLowerCase()}|${Math.round(lead.lat * 2000)}|${Math.round(lead.lon * 2000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    leads.push(lead);
  }
  leads.sort((a, b) => b.score - a.score || a.distanceM - b.distanceM);
  return leads.slice(0, max);
}
