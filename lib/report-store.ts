/**
 * In-memory report store (Phase B · B5).
 *
 * Holds analyzed reports so the results page can look one up by id. This lives
 * only for the dev-server process lifetime — good enough to run Phase B before
 * any database exists.
 *
 * TODO (Phase C): replace with the Supabase `results` table. Keep the same
 * getReport/putReport surface so callers don't change.
 */

import type { Report } from "@/lib/types";

// A globalThis singleton so the route handler and the RSC report page share the
// SAME map across module/bundle boundaries and survive dev hot-reloads.
const globalForReports = globalThis as unknown as {
  __skiniqReports?: Map<string, Report>;
};
const reports =
  globalForReports.__skiniqReports ?? (globalForReports.__skiniqReports = new Map());

/** Store a report and return its id (already set on the report). */
export function putReport(report: Report): string {
  reports.set(report.id, report);
  return report.id;
}

/** Look up a report by id, or undefined if it isn't in memory. */
export function getReport(id: string): Report | undefined {
  return reports.get(id);
}
