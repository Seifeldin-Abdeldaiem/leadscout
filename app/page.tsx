"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RiBriefcase4Line,
  RiCrosshair2Line,
  RiDownload2Line,
  RiGithubFill,
  RiMapPin2Line,
  RiSearchLine,
} from "@remixicon/react";
import type { Lead } from "@/lib/leads";
import { leadsToCsv } from "@/lib/csv";
import { Button } from "@/components/tremor/Button";
import { Card } from "@/components/tremor/Card";
import { SelectNative } from "@/components/tremor/SelectNative";
import { Switch } from "@/components/tremor/Switch";
import { LeadRow } from "@/components/lead-row";
import { cx } from "@/lib/tremor/cx";
import { focusInput } from "@/lib/tremor/focusInput";

const LeadMap = dynamic(() => import("@/components/lead-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />,
});

type Result = {
  place: { lat: number; lon: number; label: string };
  profile: { id: string; label: string; pitch: string };
  radiusKm: number;
  requestedRadiusKm?: number;
  leads: Lead[];
};

const EXAMPLES = ["Web design agency", "Commercial cleaning", "Bookkeeping", "IT support", "Coffee supplier"];
const REPO_URL = "https://github.com/Seifeldin-Abdeldaiem/leadscout";

const fieldClass = cx(
  "h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 text-sm text-gray-900 shadow-xs outline-hidden placeholder:text-gray-400",
  focusInput,
);

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="font-mono text-lg font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const shown = useMemo(
    () => (result ? result.leads.filter((l) => !onlyNoWebsite || !l.website) : []),
    [result, onlyNoWebsite],
  );
  const centre = useMemo(() => (result ? { lat: result.place.lat, lon: result.place.lon } : null), [result]);

  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

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
        setLocation("Current location");
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
    setSelectedId(null);
    setOnlyNoWebsite(false);
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

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      {/* Top bar with search */}
      <header className="z-10 border-b border-gray-200 bg-white">
        <form onSubmit={search} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:gap-3">
          <div className="flex items-center justify-between lg:w-[200px] lg:shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-blue-600 text-white">
                <RiMapPin2Line className="size-4" aria-hidden />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">LeadScout</span>
            </Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-900 lg:hidden" aria-label="Source on GitHub">
              <RiGithubFill className="size-5" />
            </a>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
            <label className="relative col-span-2 sm:col-span-1">
              <span className="sr-only">What does your business sell?</span>
              <RiBriefcase4Line className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                required
                minLength={2}
                maxLength={200}
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="What you sell, e.g. web design"
                className={fieldClass}
              />
            </label>
            <label className="relative col-span-2 sm:col-span-1">
              <span className="sr-only">Your location</span>
              <RiMapPin2Line className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                required
                minLength={2}
                maxLength={200}
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setCoords(null);
                }}
                placeholder="Town, area or postcode"
                className={cx(fieldClass, "pr-9")}
              />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                title="Use my current location"
                aria-label="Use my current location"
                className={cx(
                  "absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700",
                  locating && "animate-pulse text-blue-600",
                )}
              >
                <RiCrosshair2Line className="size-4" />
              </button>
            </label>
            <SelectNative value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} aria-label="Search radius" className="h-9">
              {["0.5", "1", "2", "3", "5"].map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </SelectNative>
            <Button type="submit" isLoading={loading} loadingText="Searching" className="h-9 gap-1.5">
              <RiSearchLine className="size-4" aria-hidden /> Find leads
            </Button>
          </div>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 lg:flex"
          >
            <RiGithubFill className="size-4" aria-hidden /> Source
          </a>
        </form>
      </header>

      {/* Workspace: list + map */}
      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[260px_1fr] md:grid-cols-[400px_1fr] md:grid-rows-1">
        <aside className="order-2 flex min-h-0 min-w-0 flex-col border-gray-200 bg-white md:order-1 md:border-r">
          {error && (
            <div role="alert" className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {!result && !loading && (
            <div className="overflow-y-auto p-5">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">Find local prospects</h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Enter what your business sells and where you&apos;re based. LeadScout finds nearby businesses likely to
                buy from you, scores each one, and shows their public contact details on the map.
              </p>
              <p className="mt-5 text-xs font-medium uppercase tracking-wide text-gray-500">Try an example</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setBusiness(ex)}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <Card className="mt-6 p-4">
                <p className="text-sm font-medium text-gray-900">How leads are scored</p>
                <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
                  <li>• Matches your business to the types of local business that typically buy it</li>
                  <li>• Rewards closeness and available phone, email and website</li>
                  <li>• Flags buying signals, such as a café with no website for a web designer</li>
                  <li>• Ranks chains lower, since they usually buy centrally</li>
                </ul>
              </Card>
            </div>
          )}

          {loading && (
            <ul className="overflow-hidden" aria-busy="true" aria-label="Loading leads">
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="flex gap-3 border-b border-gray-100 px-4 py-3">
                  <div className="h-6 w-10 animate-pulse rounded-md bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {result && !loading && (
            <>
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {shown.length} leads · {result.profile.label}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      Within {result.radiusKm} km of {result.place.label.split(",").slice(0, 2).join(",")}
                    </p>
                  </div>
                  <Button variant="secondary" className="h-8 shrink-0 gap-1 px-2.5 text-xs" onClick={() => downloadCsv(shown)} disabled={!shown.length}>
                    <RiDownload2Line className="size-3.5" aria-hidden /> CSV
                  </Button>
                </div>
                {result.requestedRadiusKm && (
                  <p className="mt-2 text-xs text-amber-700">
                    Map servers were busy, so this covers {result.radiusKm} km instead of {result.requestedRadiusKm} km.
                  </p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Kpi label="Leads" value={result.leads.length} />
                  <Kpi label="With phone" value={result.leads.filter((l) => l.phone).length} />
                  <Kpi label="No website" value={result.leads.filter((l) => !l.website).length} />
                </div>
                {result.profile.id === "web" && (
                  <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                    <Switch checked={onlyNoWebsite} onCheckedChange={setOnlyNoWebsite} size="small" />
                    Only businesses without a website
                  </label>
                )}
              </div>

              {shown.length === 0 ? (
                <p className="p-4 text-sm text-gray-600">No matching businesses. Try a larger radius or a nearby town centre.</p>
              ) : (
                <ol className="min-h-0 flex-1 overflow-y-auto">
                  {shown.map((l) => (
                    <LeadRow
                      key={l.id}
                      ref={(node) => {
                        if (node) rowRefs.current.set(l.id, node);
                        else rowRefs.current.delete(l.id);
                      }}
                      lead={l}
                      selected={selectedId === l.id}
                      onSelect={() => setSelectedId(selectedId === l.id ? null : l.id)}
                      onHover={(h) => setHoveredId(h ? l.id : null)}
                    />
                  ))}
                </ol>
              )}
            </>
          )}

          <footer className="mt-auto border-t border-gray-200 px-4 py-2.5 text-[11px] leading-relaxed text-gray-500">
            Built by Seifeldin Abdeldaiem ·{" "}
            <a className="underline hover:text-gray-800" href={REPO_URL} target="_blank" rel="noopener noreferrer">
              source
            </a>{" "}
            · Data ©{" "}
            <a className="underline hover:text-gray-800" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{" "}
            via{" "}
            <a className="underline hover:text-gray-800" href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
              Geoapify
            </a>
            . Searches aren&apos;t stored; follow UK PECR/GDPR before contacting anyone.
          </footer>
        </aside>

        <section className="relative order-1 min-h-0 md:order-2">
          <LeadMap
            centre={centre}
            radiusKm={result?.radiusKm ?? null}
            leads={shown}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
          />
          {result && (
            <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-md border border-gray-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-gray-600 shadow-xs">
              <span className="mr-2 inline-flex items-center gap-1"><span className="size-2 rounded-full bg-blue-600" /> 80+</span>
              <span className="mr-2 inline-flex items-center gap-1"><span className="size-2 rounded-full bg-blue-400" /> 60–79</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-gray-400" /> &lt;60</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
