import type { Lead } from "./leads";

/** Quote a CSV cell and neutralise spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = ["Score", "Name", "Category", "Address", "Phone", "Email", "Website", "Distance (m)", "Why", "Map"];
  const rows = leads.map((l) =>
    [l.score, l.name, l.category, l.address, l.phone, l.email, l.website, l.distanceM, l.reasons.join("; "), l.osmUrl]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}
