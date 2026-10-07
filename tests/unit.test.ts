import { describe, expect, it } from "vitest";
import { matchProfile, DEFAULT_PROFILE, PROFILES } from "@/lib/targets";
import { buildOverpassQuery, runOverpass, type OsmElement } from "@/lib/osm";
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
  it("builds a union around the point, named places only", () => {
    const q = buildOverpassQuery([{ key: "shop" }, { key: "amenity", values: ["cafe", "pub"] }], 51.5, -0.1, 2000);
    expect(q).toContain('nwr["shop"]["name"](around:2000,51.500000,-0.100000);');
    expect(q).toContain('nwr["amenity"~"^(cafe|pub)$"]["name"]');
    expect(q).toMatch(/out center tags \d+;$/);
  });

  it("rejects unsafe tag filters", () => {
    expect(() => buildOverpassQuery([{ key: 'shop"];out;' }], 1, 1, 100)).toThrow();
    expect(() => buildOverpassQuery([{ key: "shop" }], NaN, 1, 100)).toThrow();
  });
});

describe("runOverpass failover", () => {
  it("tries the next mirror when one fails", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      if (calls.length === 1) throw new TypeError("network");
      return new Response(JSON.stringify({ elements: [{ type: "node", id: 1 }] }));
    }) as unknown as typeof fetch;
    const out = await runOverpass("q", fake);
    expect(out).toHaveLength(1);
    expect(calls).toHaveLength(2);
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
          expect(q).toContain("around:1000");
          return [{ type: "node", id: 7, lat: 51.5246, lon: -0.0781, tags: { name: "Corner Cafe", amenity: "cafe" } }];
        },
      },
    );
    expect(result.profile.id).toBe("web");
    expect(result.leads[0].name).toBe("Corner Cafe");
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
