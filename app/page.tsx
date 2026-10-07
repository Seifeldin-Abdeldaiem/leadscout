"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Download,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";
import type { Lead } from "@/lib/leads";
import { leadsToCsv } from "@/lib/csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DotPattern } from "@/components/ui/dot-pattern";
import { BlurFade } from "@/components/ui/blur-fade";
import { LeadCard, LeadCardSkeleton } from "@/components/lead-card";
import { cn } from "@/lib/utils";

type Result = {
  place: { lat: number; lon: number; label: string };
  profile: { id: string; label: string; pitch: string };
  radiusKm: number;
  requestedRadiusKm?: number;
  leads: Lead[];
};

const EXAMPLES = ["Web design agency", "Commercial cleaning", "Bookkeeping & payroll", "IT support", "Coffee bean supplier"];
const REPO_URL = "https://github.com/Seifeldin-Abdeldaiem/leadscout";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export default function Home() {
  const [business, setBusiness] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState("2");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser can't share its location — type a town or postcode instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocation("My current location");
        setLocating(false);
      },
      () => {
        setError("Location permission was declined — type a town or postcode instead.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setOnlyNoWebsite(false);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const radius = Number(radiusKm);
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(coords ? { business, radiusKm: radius, ...coords } : { business, location, radiusKm: radius }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv(leads: Lead[]) {
    const blob = new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leadscout-leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const shown = result ? result.leads.filter((l) => !onlyNoWebsite || !l.website) : [];
  const withPhone = result ? result.leads.filter((l) => l.phone).length : 0;
  const showResults = loading || !!result || !!error;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <a href="#" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Radar className="size-4" aria-hidden />
            </span>
            LeadScout
          </a>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#how" className="hidden rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground sm:block">
              How it works
            </a>
            <Button asChild variant="outline" size="sm">
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <GitHubIcon className="size-3.5" /> Source
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero + search */}
        <section className="relative overflow-hidden border-b">
          <DotPattern
            className={cn(
              "text-primary/25 [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]",
            )}
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 pb-14 pt-12 sm:pt-20">
            <BlurFade delay={0.05} inView>
              <Badge variant="outline" className="mb-4 gap-1.5 bg-background">
                <Zap className="size-3 text-primary" aria-hidden /> Free · no sign-up · results in seconds
              </Badge>
            </BlurFade>
            <BlurFade delay={0.1} inView>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                Find your next clients <span className="text-primary">on your doorstep</span>
              </h1>
            </BlurFade>
            <BlurFade delay={0.15} inView>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
                Tell LeadScout what you sell and where you are. It finds nearby businesses likely to buy from you,
                ranks them, and hands you their public contact details.
              </p>
            </BlurFade>

            <BlurFade delay={0.2} inView>
              <Card className="mt-8 shadow-lg">
                <CardContent>
                  <form onSubmit={search} className="grid gap-4 sm:grid-cols-[1.4fr_1.4fr_0.7fr_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <Label htmlFor="business">What does your business do?</Label>
                      <div className="relative">
                        <Briefcase className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                          id="business"
                          required
                          minLength={2}
                          maxLength={200}
                          value={business}
                          onChange={(e) => setBusiness(e.target.value)}
                          placeholder="e.g. Web design agency"
                          className="h-10 pl-8"
                        />
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="location">Where are you?</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                          <Input
                            id="location"
                            required
                            minLength={2}
                            maxLength={200}
                            value={location}
                            onChange={(e) => {
                              setLocation(e.target.value);
                              setCoords(null);
                            }}
                            placeholder="Town, area or postcode"
                            className="h-10 pl-8"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-10 shrink-0"
                          onClick={useMyLocation}
                          disabled={locating}
                          title="Use my current location"
                          aria-label="Use my current location"
                        >
                          {locating ? <LoaderCircle className="animate-spin" /> : <LocateFixed />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="radius">Radius</Label>
                      <Select value={radiusKm} onValueChange={setRadiusKm}>
                        <SelectTrigger id="radius" className="w-full data-[size=default]:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["0.5", "1", "2", "3", "5"].map((r) => (
                            <SelectItem key={r} value={r}>
                              {r} km
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button type="submit" disabled={loading} className="h-10 px-5">
                      {loading ? <LoaderCircle className="animate-spin" /> : <Search />}
                      {loading ? "Searching…" : "Find leads"}
                    </Button>
                  </form>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Try:</span>
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setBusiness(ex)}
                        className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          </div>
        </section>

        {/* Results */}
        <section ref={resultsRef} className={cn("mx-auto w-full max-w-5xl scroll-mt-16 px-4", showResults && "py-10")}>
          {error && (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading && (
            <div className="grid gap-3" aria-busy="true" aria-label="Loading leads">
              <p className="text-sm text-muted-foreground">Scanning local businesses…</p>
              {Array.from({ length: 4 }).map((_, i) => (
                <LeadCardSkeleton key={i} />
              ))}
            </div>
          )}

          {result && (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {result.leads.length} leads within {result.radiusKm} km
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Near {result.place.label.split(",").slice(0, 3).join(",")} · matched as{" "}
                    <span className="font-medium text-foreground">{result.profile.label}</span>: {result.profile.pitch}
                  </p>
                  {result.requestedRadiusKm && (
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                      The map servers were too busy for a {result.requestedRadiusKm} km search, so these results cover{" "}
                      {result.radiusKm} km. Try the bigger radius again in a few minutes.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {result.profile.id === "web" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={onlyNoWebsite}
                        onChange={(e) => setOnlyNoWebsite(e.target.checked)}
                      />
                      Only without a website
                    </label>
                  )}
                  <Button variant="outline" onClick={() => downloadCsv(shown)} disabled={!shown.length}>
                    <Download /> Export CSV
                  </Button>
                </div>
              </div>

              {result.leads.length > 0 && (
                <div className="mb-5 grid grid-cols-3 gap-3">
                  {[
                    { label: "Leads found", value: result.leads.length },
                    { label: "With a phone number", value: withPhone },
                    { label: "Top score", value: Math.max(...result.leads.map((l) => l.score)) },
                  ].map((s) => (
                    <Card key={s.label} className="gap-1 px-4 py-3">
                      <span className="text-2xl font-semibold tabular-nums">{s.value}</span>
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </Card>
                  ))}
                </div>
              )}

              {shown.length === 0 ? (
                <p className="text-muted-foreground">
                  No matching businesses found. Try a bigger radius or a nearby town centre.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {shown.map((l, i) => (
                    <li key={l.id}>
                      <BlurFade delay={Math.min(i, 8) * 0.03} inView>
                        <LeadCard lead={l} />
                      </BlurFade>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* How it works */}
        <section id="how" className="border-t bg-muted/40">
          <div className="mx-auto w-full max-w-5xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Target,
                  title: "Understands who buys from you",
                  body: "Describe your business in plain English. LeadScout maps it to the kinds of local businesses that typically need it — cafés for a web designer, offices for a cleaner.",
                },
                {
                  icon: Radar,
                  title: "Scans the map around you",
                  body: "It searches OpenStreetMap business listings within your radius and pulls each one's public phone, email and website.",
                },
                {
                  icon: ArrowRight,
                  title: "Ranks the best prospects",
                  body: "Every lead gets a 0–100 score from distance, contact details and buying signals — like a café with no website — with the reasons shown.",
                },
              ].map((step) => (
                <Card key={step.title} className="px-5">
                  <step.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </Card>
              ))}
            </div>
            <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Your searches aren&apos;t stored. Listings are public business information — follow your local marketing
              rules (e.g. UK PECR / GDPR) before contacting anyone.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Built by Seifeldin Abdeldaiem ·{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href={REPO_URL} target="_blank" rel="noopener noreferrer">
              source on GitHub
            </a>
          </p>
          <p>
            Business data ©{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap contributors
            </a>{" "}
            (ODbL), via{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
              Geoapify
            </a>{" "}
            and the Overpass API.
          </p>
        </div>
      </footer>
    </div>
  );
}
