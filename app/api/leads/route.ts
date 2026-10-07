import type { NextRequest } from "next/server";
import { InputError, parseInput, searchLeads } from "@/lib/search";
import { RateLimiter } from "@/lib/limits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limiter = new RateLimiter(Number(process.env.SEARCHES_PER_MINUTE || 8), 60_000);

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  if (!limiter.allow(clientKey(req))) {
    return Response.json({ error: "Too many searches — wait a minute and try again." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }
  try {
    const input = parseInput(body);
    const result = await searchLeads(input);
    // Log counts and timings only — never the user's location or business text.
    console.log(JSON.stringify({ evt: "search", profile: result.profile.id, leads: result.leads.length, cached: result.cached, ms: Date.now() - started }));
    return Response.json(result);
  } catch (e) {
    if (e instanceof InputError) return Response.json({ error: e.message }, { status: 400 });
    console.error(JSON.stringify({ evt: "search_error", err: (e as Error).message.slice(0, 200), ms: Date.now() - started }));
    return Response.json(
      { error: "The free map data servers are busy right now. Please try again in a minute, or use a smaller search radius." },
      { status: 503 },
    );
  }
}
