import { forwardRef } from "react";
import { RiGlobalLine, RiMailLine, RiMapPin2Line, RiPhoneLine } from "@remixicon/react";
import type { Lead } from "@/lib/leads";
import { Badge } from "@/components/tremor/Badge";
import { cx } from "@/lib/tremor/cx";

function formatDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function scoreVariant(score: number): "default" | "neutral" {
  return score >= 60 ? "default" : "neutral";
}

type Props = {
  lead: Lead;
  selected: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
};

export const LeadRow = forwardRef<HTMLLIElement, Props>(function LeadRow({ lead, selected, onSelect, onHover }, ref) {
  return (
    <li
      ref={ref}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cx(
        "border-b border-gray-100 transition-colors",
        selected ? "bg-blue-50/70" : "hover:bg-gray-50",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 px-4 pb-2 pt-3 text-left">
        <Badge variant={scoreVariant(lead.score)} className="mt-0.5 w-10 justify-center font-mono tabular-nums">
          {lead.score}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{lead.name}</p>
            <span className="shrink-0 font-mono text-xs text-gray-500">{formatDistance(lead.distanceM)}</span>
          </div>
          <p className="truncate text-xs capitalize text-gray-500">
            {lead.category}
            {lead.address ? ` · ${lead.address}` : ""}
          </p>
        </div>
      </button>

      <div className={cx("px-4 pb-3 pl-[4.25rem]", selected ? "block" : "hidden")}>
        {lead.reasons.length > 0 && (
          <ul className="mb-2 space-y-0.5 text-xs text-gray-600">
            {lead.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
          {lead.phone && (
            <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}>
              <RiPhoneLine className="size-3.5" aria-hidden /> {lead.phone}
            </a>
          )}
          {lead.email && (
            <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href={`mailto:${encodeURIComponent(lead.email)}`}>
              <RiMailLine className="size-3.5" aria-hidden /> {lead.email}
            </a>
          )}
          {lead.website && (
            <a
              className="inline-flex max-w-full items-center gap-1 truncate text-blue-600 hover:underline"
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              <RiGlobalLine className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
            </a>
          )}
          <a className="inline-flex items-center gap-1 text-gray-600 hover:underline" href={lead.osmUrl} target="_blank" rel="noopener noreferrer">
            <RiMapPin2Line className="size-3.5" aria-hidden /> OpenStreetMap
          </a>
        </div>
      </div>

      {/* Compact contact hints when collapsed */}
      {!selected && (lead.phone || lead.email || lead.website) && (
        <div className="-mt-1 flex gap-2 px-4 pb-3 pl-[4.25rem] text-gray-400">
          {lead.phone && <RiPhoneLine className="size-3.5" aria-label="Has phone" />}
          {lead.email && <RiMailLine className="size-3.5" aria-label="Has email" />}
          {lead.website && <RiGlobalLine className="size-3.5" aria-label="Has website" />}
        </div>
      )}
    </li>
  );
});
