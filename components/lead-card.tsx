import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function scoreTone(score: number) {
  if (score >= 80) return "bg-primary text-primary-foreground";
  if (score >= 60) return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
}

function ContactLink({ href, icon: Icon, children, external }: {
  href: string;
  icon: typeof Phone;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-sm transition-colors hover:border-primary hover:text-primary"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </a>
  );
}

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Card className="gap-0 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <div
          className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-lg tabular-nums", scoreTone(lead.score))}
          title="Lead score out of 100"
        >
          <span className="text-lg font-bold leading-none">{lead.score}</span>
          <span className="text-[10px] uppercase tracking-wide opacity-80">score</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-semibold leading-tight">{lead.name}</h3>
            <Badge variant="secondary" className="capitalize">{lead.category}</Badge>
            <span className="text-sm text-muted-foreground">{formatDistance(lead.distanceM)} away</span>
          </div>
          {lead.address && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{lead.address}</span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {lead.phone && (
              <ContactLink href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`} icon={Phone}>
                {lead.phone}
              </ContactLink>
            )}
            {lead.email && (
              <ContactLink href={`mailto:${encodeURIComponent(lead.email)}`} icon={Mail}>
                {lead.email}
              </ContactLink>
            )}
            {lead.website && (
              <ContactLink href={lead.website} icon={Globe} external>
                {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </ContactLink>
            )}
            <ContactLink href={lead.osmUrl} icon={MapPin} external>
              Map
            </ContactLink>
          </div>

          {lead.reasons.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {lead.reasons.map((r) => (
                <li key={r} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

export function LeadCardSkeleton() {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start gap-4">
        <div className="size-12 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          <div className="flex gap-2 pt-1">
            <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
            <div className="h-7 w-20 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </Card>
  );
}
