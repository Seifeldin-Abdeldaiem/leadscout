"use client";

import { useRef, useState } from "react";
import { ChevronDown, Download, LoaderCircle, LocateFixed, Search } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { leadsToCsv } from "@/lib/csv";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
const MARQUEE = ["Cafés", "Salons", "Offices", "Clinics", "Pubs", "Gyms", "Hotels", "Shops", "Dentists", "Bakeries", "Florists", "Workshops"];
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
  const showResults = loading || !!result || !!error;

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="border-b-2 border-border bg-secondary-background">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <a href="#" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-base border-2 border-border bg-main text-lg font-bold shadow-[2px_2px_0_0_#000]">
              L
            </span>
            <span className="text-xl font-heading tracking-tight">LeadScout</span>
          </a>
          <nav className="flex items-center gap-3">
            <a href="#how" className="hidden font-bold underline-offset-4 hover:underline sm:block">
              How it works
            </a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "neutral", size: "sm" })}>
              <GitHubIcon /> Source
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b-2 border-border">
          <div className="mx-auto w-full max-w-5xl px-4 pb-14 pt-12 sm:pt-16">
            <p className="inline-block rounded-base border-2 border-border bg-accent-pink px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_#000]">
              Free · No sign-up · Live map data
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl leading-[1.02] tracking-tight sm:text-7xl">
              Find clients on your{" "}
              <span className="inline-block -rotate-1 rounded-base border-2 border-border bg-main px-3 shadow-shadow">
                doorstep.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl">
              Say what you sell and where you are. LeadScout finds the local businesses most likely to buy from you,
              scores them, and gives you their public contact details.
            </p>

            {/* Search */}
            <form
              onSubmit={search}
              className="mt-10 rounded-base border-2 border-border bg-secondary-background p-5 shadow-lg-hard sm:p-6"
            >
              <div className="grid gap-4 sm:grid-cols-[1.3fr_1.3fr_0.6fr]">
                <div className="grid gap-1.5">
                  <Label htmlFor="business" className="font-bold">
                    1. What do you sell?
                  </Label>
                  <Input
                    id="business"
                    required
                    minLength={2}
                    maxLength={200}
                    value={business}
                    onChange={(e) => setBusiness(e.target.value)}
                    placeholder="e.g. Web design agency"
                    className="h-12 text-base"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="location" className="font-bold">
                    2. Where are you?
                  </Label>
                  <div className="flex gap-2">
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
                      className="h-12 text-base"
                    />
                    <Button
                      type="button"
                      variant="neutral"
                      className="size-12 shrink-0 px-0"
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
                  <Label htmlFor="radius" className="font-bold">
                    3. How far?
                  </Label>
                  <div className="relative">
                    <select
                      id="radius"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(e.target.value)}
                      className="h-12 w-full appearance-none rounded-base border-2 border-border bg-secondary-background px-3 pr-9 text-base font-bold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                      {["0.5", "1", "2", "3", "5"].map((r) => (
                        <option key={r} value={r}>
                          {r} km
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase">Try →</span>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setBusiness(ex)}
                      className="rounded-base border-2 border-border bg-background px-2.5 py-0.5 text-sm font-bold transition-colors hover:bg-main"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <Button type="submit" disabled={loading} size="lg" className="h-12 px-8 text-base font-bold">
                  {loading ? <LoaderCircle className="animate-spin" /> : <Search />}
                  {loading ? "Searching…" : "Find leads"}
                </Button>
              </div>
            </form>
          </div>
        </section>

        {/* Marquee */}
        <div className="overflow-hidden border-b-2 border-border bg-foreground py-3 text-background" aria-hidden>
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap font-mono text-sm font-bold uppercase tracking-widest">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="flex items-center gap-8">
                {m} <span className="text-main">✦</span>
              </span>
            ))}
          </div>
        </div>

        {/* Results */}
        <section ref={resultsRef} className={cn("mx-auto w-full max-w-5xl scroll-mt-4 px-4", showResults && "py-12")}>
          {error && (
            <div role="alert" className="rounded-base border-2 border-border bg-accent-pink px-4 py-3 font-bold shadow-shadow">
              {error}
            </div>
          )}

          {loading && (
            <div className="grid gap-4" aria-busy="true" aria-label="Loading leads">
              <p className="font-mono text-sm font-bold uppercase">Scanning local businesses…</p>
              {Array.from({ length: 3 }).map((_, i) => (
                <LeadCardSkeleton key={i} />
              ))}
            </div>
          )}

          {result && (
            <>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl tracking-tight sm:text-4xl">
                    {result.leads.length} leads within {result.radiusKm} km
                  </h2>
                  <p className="mt-2">
                    Near <b>{result.place.label.split(",").slice(0, 2).join(",")}</b> · matched as{" "}
                    <span className="rounded-base border-2 border-border bg-main px-1.5 font-bold">{result.profile.label}</span>
                  </p>
                  {result.requestedRadiusKm && (
                    <p className="mt-2 text-sm font-bold">
                      ⚠ The map servers were too busy for a {result.requestedRadiusKm} km search, so these results cover{" "}
                      {result.radiusKm} km.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {result.profile.id === "web" && (
                    <label className="flex cursor-pointer items-center gap-2 font-bold">
                      <input
                        type="checkbox"
                        className="size-5 accent-black"
                        checked={onlyNoWebsite}
                        onChange={(e) => setOnlyNoWebsite(e.target.checked)}
                      />
                      No website only
                    </label>
                  )}
                  <Button variant="neutral" onClick={() => downloadCsv(shown)} disabled={!shown.length}>
                    <Download /> Export CSV
                  </Button>
                </div>
              </div>

              {result.leads.length > 0 && (
                <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { label: "Leads found", value: result.leads.length, bg: "bg-accent-green" },
                    { label: "With phone", value: result.leads.filter((l) => l.phone).length, bg: "bg-accent-blue" },
                    { label: "Top score", value: Math.max(...result.leads.map((l) => l.score)), bg: "bg-accent-pink" },
                  ].map((s) => (
                    <div key={s.label} className={cn("rounded-base border-2 border-border p-3 shadow-shadow sm:p-4", s.bg)}>
                      <div className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">{s.value}</div>
                      <div className="text-xs font-bold uppercase sm:text-sm">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {shown.length === 0 ? (
                <p className="font-bold">No matching businesses found. Try a bigger radius or a nearby town centre.</p>
              ) : (
                <ol className="grid gap-4">
                  {shown.map((l, i) => (
                    <li key={l.id}>
                      <LeadCard lead={l} rank={i + 1} />
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>

        {/* How it works */}
        <section id="how" className="border-t-2 border-border bg-secondary-background">
          <div className="mx-auto w-full max-w-5xl px-4 py-16">
            <h2 className="text-4xl tracking-tight">How it works</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {[
                {
                  n: "01",
                  bg: "bg-main",
                  title: "Understands your buyers",
                  body: "Describe your business in plain English. LeadScout maps it to the local businesses that typically need it: cafés for a web designer, offices for a cleaner.",
                },
                {
                  n: "02",
                  bg: "bg-accent-green",
                  title: "Scans the map",
                  body: "It searches OpenStreetMap business listings inside your radius and pulls each one's public phone, email and website.",
                },
                {
                  n: "03",
                  bg: "bg-accent-pink",
                  title: "Ranks the prospects",
                  body: "Each lead gets a 0–100 score from distance, contact details and buying signals, like a café with no website, with the reasons shown.",
                },
              ].map((step) => (
                <div key={step.n} className="rounded-base border-2 border-border bg-background p-5 shadow-shadow">
                  <span className={cn("inline-block rounded-base border-2 border-border px-2 font-mono text-lg font-bold", step.bg)}>
                    {step.n}
                  </span>
                  <h3 className="mt-4 text-xl">{step.title}</h3>
                  <p className="mt-2">{step.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-sm">
              Your searches aren&apos;t stored. Listings are public business information; follow your local marketing
              rules (e.g. UK PECR / GDPR) before contacting anyone.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-border bg-foreground text-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Built by <b>Seifeldin Abdeldaiem</b> ·{" "}
            <a className="underline underline-offset-2 hover:text-main" href={REPO_URL} target="_blank" rel="noopener noreferrer">
              source on GitHub
            </a>
          </p>
          <p className="text-background/70">
            Data ©{" "}
            <a className="underline underline-offset-2 hover:text-main" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{" "}
            via{" "}
            <a className="underline underline-offset-2 hover:text-main" href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
              Geoapify
            </a>
            . Design based on{" "}
            <a className="underline underline-offset-2 hover:text-main" href="https://github.com/ekmas/neobrutalism-components" target="_blank" rel="noopener noreferrer">
              neobrutalism-components
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
