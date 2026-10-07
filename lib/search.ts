import { buildOverpassQuery, geocode, reverseGeocode, runOverpass, type OsmElement, type Place } from "./osm";
import { rankLeads, type Lead } from "./leads";
import { matchProfile, type Profile } from "./targets";
import { TtlCache } from "./limits";
import { runGeoapify } from "./geoapify";

export type SearchInput = {
  business: string;
  location?: string;
  lat?: number;
  lon?: number;
  radiusKm: number;
};

export type SearchResult = {
  place: Place;
  profile: { id: string; label: string; pitch: string };
  radiusKm: number;
  /** Set when the map servers were too busy for the requested radius and a smaller one was used. */
  requestedRadiusKm?: number;
  leads: Lead[];
  cached: boolean;
};

/** Radius used for the automatic retry when a bigger search can't be served. */
export const FALLBACK_RADIUS_KM = 1;

export class InputError extends Error {}

export function parseInput(body: unknown): SearchInput {
  if (!body || typeof body !== "object") throw new InputError("Send a JSON body.");
  const b = body as Record<string, unknown>;
  const business = typeof b.business === "string" ? b.business.trim() : "";
  if (business.length < 2 || business.length > 200) {
    throw new InputError("Describe your business in 2–200 characters.");
  }
  const radiusKm = b.radiusKm === undefined ? 2 : Number(b.radiusKm);
  if (!Number.isFinite(radiusKm) || radiusKm < 0.3 || radiusKm > 5) {
    throw new InputError("Search radius must be between 0.3 and 5 km.");
  }
  const lat = b.lat === undefined || b.lat === null ? undefined : Number(b.lat);
  const lon = b.lon === undefined || b.lon === null ? undefined : Number(b.lon);
  if (lat !== undefined || lon !== undefined) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat!) > 90 || Math.abs(lon!) > 180) {
      throw new InputError("Invalid coordinates.");
    }
    return { business, lat, lon, radiusKm };
  }
  const location = typeof b.location === "string" ? b.location.trim() : "";
  if (location.length < 2 || location.length > 200) {
    throw new InputError("Enter a location (town, area or postcode) or use your current location.");
  }
  return { business, location, radiusKm };
}

const placeCache = new TtlCache<Place>(24 * 3600_000);
const osmCache = new TtlCache<OsmElement[]>(3600_000, 200);

export type Deps = {
  geocode: typeof geocode;
  reverseGeocode: typeof reverseGeocode;
  runOverpass: typeof runOverpass;
  /** Optional hosted source, tried first when configured. */
  runGeoapify?: (filters: Profile["targets"], lat: number, lon: number, radiusM: number) => Promise<OsmElement[]>;
};
const geoKey = process.env.GEOAPIFY_API_KEY?.trim();
const realDeps: Deps = {
  geocode,
  reverseGeocode,
  runOverpass,
  runGeoapify: geoKey ? (f, lat, lon, r) => runGeoapify(f, lat, lon, r, geoKey) : undefined,
};

export async function searchLeads(input: SearchInput, deps: Deps = realDeps): Promise<SearchResult> {
  let place: Place | null;
  if (input.lat !== undefined && input.lon !== undefined) {
    const key = `r:${input.lat.toFixed(3)},${input.lon.toFixed(3)}`;
    place = placeCache.get(key) ?? {
      lat: input.lat,
      lon: input.lon,
      label: await deps.reverseGeocode(input.lat, input.lon),
    };
    placeCache.set(key, place);
  } else {
    const key = `g:${input.location!.toLowerCase()}`;
    place = placeCache.get(key) ?? (await deps.geocode(input.location!));
    if (!place) throw new InputError(`Couldn't find "${input.location}". Try a town, area or postcode.`);
    placeCache.set(key, place);
  }

  const profile = matchProfile(input.business);
  const fetchFor = async (radiusKm: number) => {
    const radiusM = radiusKm * 1000;
    const key = `${profile.id}|${place!.lat.toFixed(3)}|${place!.lon.toFixed(3)}|${radiusM}`;
    const hit = osmCache.get(key);
    if (hit) return { elements: hit, cached: true };
    let elements: OsmElement[] | undefined;
    if (deps.runGeoapify) {
      try {
        elements = await deps.runGeoapify(profile.targets, place!.lat, place!.lon, radiusM);
      } catch (e) {
        console.error(JSON.stringify({ evt: "geoapify_error", err: (e as Error).message.slice(0, 120) }));
      }
    }
    elements ??= await deps.runOverpass(buildOverpassQuery(profile.targets, place!.lat, place!.lon, radiusM));
    osmCache.set(key, elements);
    return { elements, cached: false };
  };

  let radiusKm = input.radiusKm;
  let requestedRadiusKm: number | undefined;
  let got: { elements: OsmElement[]; cached: boolean };
  try {
    got = await fetchFor(radiusKm);
  } catch (e) {
    // Big searches are the ones busy servers drop; retry once at a lighter radius.
    if (radiusKm <= FALLBACK_RADIUS_KM) throw e;
    requestedRadiusKm = radiusKm;
    radiusKm = FALLBACK_RADIUS_KM;
    got = await fetchFor(radiusKm);
  }

  return {
    place,
    profile: { id: profile.id, label: profile.label, pitch: profile.pitch },
    radiusKm,
    requestedRadiusKm,
    leads: rankLeads(got.elements, place, radiusKm * 1000, profile),
    cached: got.cached,
  };
}
