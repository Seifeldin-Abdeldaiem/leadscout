"use client";

import { useState } from "react";
import type { Lead } from "@/lib/leads";
import { leadsToCsv } from "@/lib/csv";

type Result = {
  place: { lat: number; lon: number; label: string };
  profile: { id: string; label: string; pitch: string };
  radiusKm: number;
  requestedRadiusKm?: number;
  leads: Lead[];
};

const EXAMPLES = ["Web design agency", "Commercial cleaning", "Bookkeeping & payroll", "IT support", "Coffee bean supplier"];

function formatDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function scoreTone(s: number) {
  if (s >= 80) return "bg-emerald-600 text-white";
  if (s >= 60) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100";
  return "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
}

export default function Home() {
  const [business, setBusiness] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(2);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(false);

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
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(coords ? { business, radiusKm, ...coords } : { business, location, radiusKm }),
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
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const shown = result ? result.leads.filter((l) => !onlyNoWebsite || !l.website) : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">LeadScout</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Find clients near you</h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Tell us what you sell and where you are. We&apos;ll list local businesses likely to need it, with their public
          contact details, ranked by how promising they look.
        </p>
      </header>

      <form onSubmit={search} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium">What does your business do?</span>
          <input
            required
            minLength={2}
            maxLength={200}
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="e.g. Web design agency"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700"
          />
          <span className="flex flex-wrap gap-1.5 pt-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setBusiness(ex)}
                className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 hover:border-emerald-600 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-400"
              >
                {ex}
              </button>
            ))}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Where are you?</span>
          <div className="flex gap-2">
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
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 text-sm hover:border-emerald-600 disabled:opacity-60 dark:border-zinc-700"
            >
              {locating ? "Locating…" : "Use my location"}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Search radius</span>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          >
            {[0.5, 1, 2, 3, 5].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Finding leads… (can take ~20 s)" : "Find leads"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {result && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {result.leads.length} leads within {result.radiusKm} km
              </h2>
              {result.requestedRadiusKm && (
                <p className="mb-1 text-sm text-amber-700 dark:text-amber-400">
                  The map servers were too busy for a {result.requestedRadiusKm} km search, so these results cover {result.radiusKm} km. Try the bigger radius again in a few minutes.
                </p>
              )}
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Near {result.place.label.split(",").slice(0, 3).join(",")} · matched as <b>{result.profile.label}</b>: {result.profile.pitch}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {result.profile.id === "web" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={onlyNoWebsite} onChange={(e) => setOnlyNoWebsite(e.target.checked)} />
                  Only without a website
                </label>
              )}
              <button
                onClick={() => downloadCsv(shown)}
                disabled={!shown.length}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:border-emerald-600 disabled:opacity-50 dark:border-zinc-700"
              >
                Download CSV
              </button>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">No matching businesses found. Try a bigger radius or a nearby town centre.</p>
          ) : (
            <ul className="grid gap-3">
              {shown.map((l) => (
                <li key={l.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 rounded-md px-2 py-1 text-sm font-bold tabular-nums ${scoreTone(l.score)}`} title="Lead score out of 100">
                      {l.score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <h3 className="font-semibold">{l.name}</h3>
                        <span className="text-sm capitalize text-zinc-500">{l.category}</span>
                        <span className="text-sm text-zinc-500">· {formatDistance(l.distanceM)}</span>
                      </div>
                      {l.address && <p className="text-sm text-zinc-600 dark:text-zinc-400">{l.address}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {l.phone && <a className="text-emerald-700 hover:underline dark:text-emerald-400" href={`tel:${l.phone.replace(/[^+\d]/g, "")}`}>{l.phone}</a>}
                        {l.email && <a className="text-emerald-700 hover:underline dark:text-emerald-400" href={`mailto:${encodeURIComponent(l.email)}`}>{l.email}</a>}
                        {l.website && <a className="truncate text-emerald-700 hover:underline dark:text-emerald-400" href={l.website} target="_blank" rel="noopener noreferrer nofollow">{l.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
                        <a className="text-zinc-500 hover:underline" href={l.osmUrl} target="_blank" rel="noopener noreferrer">Map</a>
                      </div>
                      {l.reasons.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {l.reasons.map((r) => (
                            <li key={r} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer className="mt-12 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Business data © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL).
        Listings are public business information; follow your local marketing rules (e.g. UK PECR/GDPR) before contacting anyone. Your searches aren&apos;t stored.
      </footer>
    </main>
  );
}
