import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { cn } from "@/lib/utils";

function formatDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function scoreColour(score: number) {
  if (score >= 80) return "bg-accent-green";
  if (score >= 60) return "bg-main";
  return "bg-secondary-background";
}

function Chip({ href, icon: Icon, children, external }: {
  href: string;
  icon: typeof Phone;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
      className="inline-flex max-w-full items-center gap-1.5 rounded-base border-2 border-border bg-secondary-background px-2.5 py-1 text-sm font-bold shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-main hover:shadow-none"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </a>
  );
}

export function LeadCard({ lead, rank }: { lead: Lead; rank: number }) {
  return (
    <article className="flex gap-4 rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div
          className={cn(
            "flex size-14 flex-col items-center justify-center rounded-base border-2 border-border font-mono tabular-nums",
            scoreColour(lead.score),
          )}
          title="Lead score out of 100"
        >
          <span className="text-xl font-bold leading-none">{lead.score}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider">score</span>
        </div>
        <span className="font-mono text-xs text-foreground/60">#{rank}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-lg leading-tight">{lead.name}</h3>
          <span className="rounded-base border-2 border-border bg-accent-blue px-2 py-0.5 text-xs font-bold capitalize">
            {lead.category}
          </span>
          <span className="font-mono text-xs">{formatDistance(lead.distanceM)} away</span>
        </div>
        {lead.address && (
          <p className="mt-1 flex items-center gap-1 text-sm text-foreground/70">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{lead.address}</span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {lead.phone && (
            <Chip href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`} icon={Phone}>
              {lead.phone}
            </Chip>
          )}
          {lead.email && (
            <Chip href={`mailto:${encodeURIComponent(lead.email)}`} icon={Mail}>
              {lead.email}
            </Chip>
          )}
          {lead.website && (
            <Chip href={lead.website} icon={Globe} external>
              {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </Chip>
          )}
          <Chip href={lead.osmUrl} icon={MapPin} external>
            Map
          </Chip>
        </div>

        {lead.reasons.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-sm">
            {lead.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden>→</span>
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow">
      <div className="size-14 animate-pulse rounded-base border-2 border-border bg-main/40" />
      <div className="flex-1 space-y-2">
        <div className="h-5 w-1/3 animate-pulse rounded-base bg-foreground/10" />
        <div className="h-3 w-1/2 animate-pulse rounded-base bg-foreground/10" />
        <div className="flex gap-2 pt-1">
          <div className="h-7 w-28 animate-pulse rounded-base bg-foreground/10" />
          <div className="h-7 w-16 animate-pulse rounded-base bg-foreground/10" />
        </div>
      </div>
    </div>
  );
}
