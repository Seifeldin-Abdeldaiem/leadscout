import { beforeEach, describe, expect, it } from "vitest";
import { matchProfile, DEFAULT_PROFILE, PROFILES } from "@/lib/targets";
import { buildOverpassQuery, overpassEndpoints, resetMirrorCooldowns, runOverpass, type OsmElement } from "@/lib/osm";
import { cleanWebsite, rankLeads, toLead, haversineM } from "@/lib/leads";
import { csvCell, leadsToCsv } from "@/lib/csv";
import { RateLimiter, TtlCache } from "@/lib/limits";
import { InputError, parseInput, searchLeads } from "@/lib/search";

const web = PROFILES.find((p) => p.id === "web")!;
const origin = { lat: 51.5245, lon: -0.078 };

describe("matchProfile", () => {
  it.each([
    ["Web design agency", "web"],
    ["SEO and Google ads", "web"],
    ["Commercial cleaning company", "cleaning"],
    ["Bookkeeping & payroll", "accounting"],
    ["IT support for small offices", "it"],
    ["Coffee bean supplier", "food"],
    ["Wedding photographer", "photo"],
    ["Plumbing and heating", "trades"],
  ])("%s → %s", (text, id) => {
    expect(matchProfile(text).id).toBe(id);
  });

  it("does not match short keywords inside other words", () => {
    // "it" must not match "fitness", "hr" must not match "three"
    expect(matchProfile("three fitness classes").id).toBe(DEFAULT_PROFILE.id);
  });

  it("falls back to the general profile", () => {
    expect(matchProfile("zzz").id).toBe("general");
  });
});

describe("buildOverpassQuery", () => {
  it("builds a bounding-box union of named nodes and ways", () => {
    const q = buildOverpassQuery([{ key: "shop" }, { key: "amenity", values: ["cafe", "pub"] }], 51.5, -0.1, 2000);
    expect(q).toMatch(/\[bbox:51\.48203,-0\.128\d\d,51\.51797,-0\.071\d\d\]/);
    expect(q).toContain('nw["shop"]["name"];');
    expect(q).toContain('nw["amenity"~"^(cafe|pub)$"]["name"];');
    expect(q).toMatch(/out center tags \d+;$/);
  });

  it("rejects unsafe tag filters", () => {
    expect(() => buildOverpassQuery([{ key: 'shop"];out;' }], 1, 1, 100)).toThrow();
    expect(() => buildOverpassQuery([{ key: "shop" }], NaN, 1, 100)).toThrow();
  });
});

describe("runOverpass failover", () => {
  beforeEach(() => resetMirrorCooldowns());

  it("rests a mirror that answered 429 and skips it next time", async () => {
    const first = overpassEndpoints()[0];
    const seen: string[] = [];
    const fake = (async (url: string) => {
      seen.push(url);
      if (url === first) return new Response("slow down", { status: 429 });
      return new Response(JSON.stringify({ elements: [{ type: "node", id: 1 }] }));
    }) as unknown as typeof fetch;
    await runOverpass("q", fake, 10_000);
    seen.length = 0;
    await runOverpass("q", fake, 10_000);
    expect(seen).not.toContain(first);
  });

  it("tries the next mirror when one fails", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      if (calls.length === 1) throw new TypeError("network");
      return new Response(JSON.stringify({ elements: [{ type: "node", id: 1 }] }));
    }) as unknown as typeof fetch;
    const out = await runOverpass("q", fake, 10_000);
    expect(out).toHaveLength(1);
    expect(calls).toHaveLength(2); // the failure started the next mirror immediately
  });

  it("asks a second mirror when the first is slow, and the fastest wins", async () => {
    const calls: string[] = [];
    const fake = ((url: string, init: RequestInit) => {
      calls.push(url);
      const slow = calls.length === 1;
      return new Promise<Response>((resolve, reject) => {
        const t = setTimeout(
          () => resolve(new Response(JSON.stringify({ elements: [{ type: "node", id: slow ? 1 : 2 }] }))),
          slow ? 500 : 10,
        );
        init.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;
    const out = await runOverpass("q", fake, 20);
    expect(out[0].id).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it("treats an Overpass timeout remark as a failure", async () => {
    let n = 0;
    const fake = (async () => {
      n++;
      return n === 1
        ? new Response(JSON.stringify({ elements: [], remark: "runtime error: Query timed out" }))
        : new Response(JSON.stringify({ elements: [{ type: "node", id: 3 }] }));
    }) as unknown as typeof fetch;
    expect((await runOverpass("q", fake, 10_000))[0].id).toBe(3);
  });

  it("throws when every mirror fails", async () => {
    const fake = (async () => new Response("busy", { status: 504 })) as unknown as typeof fetch;
    await expect(runOverpass("q", fake)).rejects.toThrow(/All map data servers failed/);
  });
});

describe("leads", () => {
  const cafeNoSite: OsmElement = {
    type: "node", id: 1, lat: 51.5246, lon: -0.0781,
    tags: { name: "Bean There", amenity: "cafe", phone: "+44 20 1234 5678", "addr:street": "Old St", "addr:housenumber": "12" },
  };
  const shopWithSite: OsmElement = {
    type: "way", id: 2, center: { lat: 51.53, lon: -0.07 },
    tags: { name: "Bike Hub", shop: "bicycle", website: "bikehub.example" },
  };

  it("ranks a nearby business with no website first for web sellers", () => {
    const leads = rankLeads([shopWithSite, cafeNoSite], origin, 2000, web);
    expect(leads[0].name).toBe("Bean There");
    expect(leads[0].reasons.join(" ")).toMatch(/No website/);
    expect(leads[0].address).toBe("12 Old St");
    expect(leads[1].website).toBe("https://bikehub.example/");
    expect(leads[1].category).toBe("bicycle (shop)");
  });

  it("drops unnamed elements and duplicates", () => {
    const dup = { ...cafeNoSite, type: "way" as const, id: 99 };
    const unnamed: OsmElement = { type: "node", id: 3, lat: 51.5, lon: -0.1, tags: { shop: "bakery" } };
    expect(rankLeads([cafeNoSite, dup, unnamed], origin, 2000, web)).toHaveLength(1);
  });

  it("only keeps http(s) websites", () => {
    expect(cleanWebsite("javascript:alert(1)")).toBeUndefined();
    expect(cleanWebsite("http://a.example;https://b.example")).toBe("http://a.example/");
  });

  it("scores stay within 0–100", () => {
    const l = toLead({ ...cafeNoSite, tags: { ...cafeNoSite.tags!, email: "a@b.c", opening_hours: "24/7" } }, origin, 2000, web)!;
    expect(l.score).toBeLessThanOrEqual(100);
  });

  it("ranks chains below independents", () => {
    const chain = { ...cafeNoSite, id: 5, tags: { ...cafeNoSite.tags!, name: "Big Coffee", brand: "Big Coffee" } };
    const leads = rankLeads([chain, cafeNoSite], origin, 2000, web);
    expect(leads[0].name).toBe("Bean There");
    expect(leads[1].reasons.join(" ")).toMatch(/chain/);
  });

  it("drops places outside the radius (bounding-box corners)", () => {
    const far: OsmElement = { type: "node", id: 8, lat: 51.54, lon: -0.04, tags: { name: "Far Cafe", amenity: "cafe" } };
    expect(toLead(far, origin, 2000, web)).toBeNull();
  });

  it("haversine is sane", () => {
    expect(Math.round(haversineM(51.5, 0, 51.501, 0))).toBe(111);
  });
});

describe("csv", () => {
  it("neutralises formula injection and quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
    expect(csvCell(undefined)).toBe('""');
  });
  it("has a header row", () => {
    expect(leadsToCsv([]).split("\r\n")[0]).toContain('"Name"');
  });
});

describe("limits", () => {
  it("rate limiter blocks after the limit within the window", () => {
    const r = new RateLimiter(2, 1000);
    expect(r.allow("a", 0)).toBe(true);
    expect(r.allow("a", 1)).toBe(true);
    expect(r.allow("a", 2)).toBe(false);
    expect(r.allow("a", 1500)).toBe(true);
  });
  it("cache expires", () => {
    const c = new TtlCache<number>(100);
    c.set("k", 1, 0);
    expect(c.get("k", 50)).toBe(1);
    expect(c.get("k", 200)).toBeUndefined();
  });
});

describe("parseInput", () => {
  it("accepts a text location", () => {
    expect(parseInput({ business: "cleaning", location: "Leeds" })).toEqual({ business: "cleaning", location: "Leeds", radiusKm: 2 });
  });
  it("accepts coordinates", () => {
    expect(parseInput({ business: "cleaning", lat: 51, lon: 0, radiusKm: 1 }).lat).toBe(51);
  });
  it.each([
    [{}],
    [{ business: "x", location: "Leeds" }],
    [{ business: "cleaning" }],
    [{ business: "cleaning", location: "Leeds", radiusKm: 50 }],
    [{ business: "cleaning", lat: 200, lon: 0 }],
  ])("rejects %j", (body) => {
    expect(() => parseInput(body)).toThrow(InputError);
  });
});

describe("searchLeads (stubbed network)", () => {
  it("geocodes, queries and ranks", async () => {
    const result = await searchLeads(
      { business: "web design", location: "Testville", radiusKm: 1 },
      {
        geocode: async () => ({ ...origin, label: "Testville, UK" }),
        reverseGeocode: async () => "x",
        runOverpass: async (q) => {
          expect(q).toContain("[bbox:");
          return [{ type: "node", id: 7, lat: 51.5246, lon: -0.0781, tags: { name: "Corner Cafe", amenity: "cafe" } }];
        },
      },
    );
    expect(result.profile.id).toBe("web");
    expect(result.leads[0].name).toBe("Corner Cafe");
  });

  it("falls back to a 1 km search when the big one fails", async () => {
    const radii: string[] = [];
    const result = await searchLeads(
      { business: "web design", location: "Bigcity", radiusKm: 5 },
      {
        geocode: async () => ({ lat: 52.1, lon: 0.1, label: "Bigcity" }),
        reverseGeocode: async () => "x",
        runOverpass: async (q) => {
          radii.push(q.match(/bbox:([^\]]+)/)![1]);
          if (radii.length === 1) throw new Error("All map data servers failed");
          return [{ type: "node", id: 9, lat: 52.1001, lon: 0.1001, tags: { name: "Near Cafe", amenity: "cafe" } }];
        },
      },
    );
    expect(radii).toHaveLength(2);
    expect(result.radiusKm).toBe(1);
    expect(result.requestedRadiusKm).toBe(5);
    expect(result.leads[0].name).toBe("Near Cafe");
  });

  it("reports an unknown place as a user error", async () => {
    await expect(
      searchLeads(
        { business: "web design", location: "Nowhere-at-all", radiusKm: 1 },
        { geocode: async () => null, reverseGeocode: async () => "", runOverpass: async () => [] },
      ),
    ).rejects.toThrow(InputError);
  });
});
