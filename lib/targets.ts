/**
 * Maps "what your business sells" to "which kinds of local businesses are
 * likely to buy it", expressed as OpenStreetMap tag filters.
 */

export type TagFilter = { key: string; values?: string[] };

export type Profile = {
  id: string;
  label: string;
  keywords: string[];
  targets: TagFilter[];
  /** Web/marketing sellers: a business with no website is the best lead. */
  missingWebsiteIsOpportunity?: boolean;
  pitch: string;
};

const HOSPITALITY: TagFilter = {
  key: "amenity",
  values: ["restaurant", "cafe", "bar", "pub", "fast_food"],
};
const HEALTH: TagFilter = {
  key: "amenity",
  values: ["dentist", "doctors", "clinic", "pharmacy", "veterinary"],
};
const HOTELS: TagFilter = { key: "tourism", values: ["hotel", "guest_house", "hostel"] };
const SHOPS: TagFilter = { key: "shop" };
const OFFICES: TagFilter = { key: "office" };
const CRAFT: TagFilter = { key: "craft" };
const GYMS: TagFilter = { key: "leisure", values: ["fitness_centre", "sports_centre"] };

export const PROFILES: Profile[] = [
  {
    id: "web",
    label: "Web, design & marketing",
    keywords: ["web", "website", "design", "developer", "seo", "marketing", "digital", "social media", "branding", "agency", "advert", "ads", "ppc", "copywrit"],
    targets: [HOSPITALITY, SHOPS, CRAFT, GYMS, HEALTH],
    missingWebsiteIsOpportunity: true,
    pitch: "local businesses that need to be found online",
  },
  {
    id: "accounting",
    label: "Accounting & finance",
    keywords: ["account", "bookkeep", "tax", "payroll", "finance", "audit", "cfo"],
    targets: [SHOPS, CRAFT, HOSPITALITY, OFFICES],
    pitch: "small businesses that need books, tax and payroll handled",
  },
  {
    id: "legal",
    label: "Legal services",
    keywords: ["law", "legal", "solicitor", "attorney", "lawyer", "notary", "contract"],
    targets: [OFFICES, SHOPS, CRAFT, HOSPITALITY],
    pitch: "businesses that need contracts, leases and employment advice",
  },
  {
    id: "cleaning",
    label: "Cleaning & facilities",
    keywords: ["clean", "janitor", "hygiene", "laundry", "facilities", "waste"],
    targets: [OFFICES, HOSPITALITY, HEALTH, HOTELS, GYMS],
    pitch: "premises that need regular commercial cleaning",
  },
  {
    id: "food",
    label: "Food & drink supply",
    keywords: ["cater", "bakery", "baker", "coffee", "food", "wholesale", "produce", "supplier", "drinks", "brew", "wine", "beer", "dairy", "meat"],
    targets: [HOSPITALITY, HOTELS, { key: "shop", values: ["convenience", "deli", "supermarket", "greengrocer"] }],
    pitch: "venues that buy food and drink stock",
  },
  {
    id: "it",
    label: "IT & tech support",
    keywords: ["it support", "it services", "computer", "network", "cyber", "software", "tech support", "managed service", "cloud", "wifi"],
    targets: [OFFICES, HEALTH, HOTELS, { key: "shop", values: ["optician", "travel_agency", "estate_agent", "copyshop"] }],
    pitch: "offices and practices that depend on their computers",
  },
  {
    id: "photo",
    label: "Photography & video",
    keywords: ["photo", "video", "film", "content creat", "drone", "videograph"],
    targets: [HOSPITALITY, HOTELS, { key: "shop", values: ["clothes", "boutique", "jewelry", "florist", "furniture", "beauty", "hairdresser"] }, { key: "office", values: ["estate_agent"] }],
    pitch: "businesses that sell visually and need fresh imagery",
  },
  {
    id: "print",
    label: "Printing & signage",
    keywords: ["print", "sign", "signage", "merch", "packaging", "label", "banner"],
    targets: [SHOPS, HOSPITALITY, OFFICES],
    pitch: "businesses that need menus, signs, cards and packaging",
  },
  {
    id: "trades",
    label: "Trades & maintenance",
    keywords: ["plumb", "electric", "builder", "repair", "maintenance", "hvac", "handyman", "roof", "pest", "glaz", "carpent", "decorat", "heating"],
    targets: [HOSPITALITY, HOTELS, SHOPS, OFFICES, HEALTH],
    pitch: "premises that need repairs and planned maintenance",
  },
  {
    id: "security",
    label: "Security",
    keywords: ["security", "cctv", "alarm", "locksmith", "guard"],
    targets: [SHOPS, { key: "amenity", values: ["bar", "pub", "nightclub", "pharmacy"] }, OFFICES],
    pitch: "premises with stock, cash or late-night trade to protect",
  },
  {
    id: "people",
    label: "Recruitment, HR, training & consulting",
    keywords: ["recruit", "staffing", "hr", "human resources", "training", "coach", "consult", "insur", "wellbeing", "health and safety"],
    targets: [OFFICES, HOSPITALITY, SHOPS, CRAFT],
    pitch: "employers that hire, train and insure staff",
  },
];

export const DEFAULT_PROFILE: Profile = {
  id: "general",
  label: "General B2B",
  keywords: [],
  targets: [SHOPS, OFFICES, { key: "amenity", values: ["restaurant", "cafe"] }],
  pitch: "local businesses in your area",
};

/** Pick the profile whose keywords best match the user's business description. */
export function matchProfile(business: string): Profile {
  const text = ` ${business.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  let best: Profile = DEFAULT_PROFILE;
  let bestScore = 0;
  for (const p of PROFILES) {
    let score = 0;
    for (const k of p.keywords) {
      // short keywords (it, hr, ads, seo) must match a whole word
      const hit = k.length <= 3 ? text.includes(` ${k} `) : text.includes(k);
      if (hit) score += k.length;
    }
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}
