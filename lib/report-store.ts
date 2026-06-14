/**
 * Report store (Phase C · C2).
 *
 * Saves analyzed reports to Supabase (the `results` table) and reads them back,
 * so reports survive server restarts and `/report/<id>` links keep working.
 *
 * Designed to degrade gracefully: if Supabase isn't configured we use an
 * in-memory Map exactly as before, and a failed DB write never fails a scan
 * (the report is still served from memory for the rest of the process).
 *
 * The DB uses snake_case columns; our Report type is camelCase, so we map
 * between them here. jsonb columns (ingredients, highlights, …) round-trip as
 * plain JS arrays.
 */

import { isSupabaseConfigured, getServerSupabase } from "@/lib/supabase";
import { signScanUrl } from "@/lib/storage";
import { ReportSchema, type Report } from "@/lib/types";

// In-memory fallback + same-process cache, kept across hot-reloads.
const globalForReports = globalThis as unknown as {
  __skiniqReports?: Map<string, Report>;
};
const reports =
  globalForReports.__skiniqReports ?? (globalForReports.__skiniqReports = new Map());

const TABLE = "results";

/** "June 12, 2026" — same format the analyze route stamps on fresh reports. */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

/** Report (camelCase) -> results row (snake_case). */
function reportToRow(r: Report, scanId?: string) {
  return {
    id: r.id,
    scan_id: scanId ?? null,
    product_name: r.productName,
    overall_score: r.overallScore,
    verdict: r.verdict,
    summary: r.summary,
    ingredients: r.ingredients,
    highlights: r.highlights,
    cautions: r.cautions,
    benefits: r.benefits,
    concern_scores: r.concernScores,
    how_to_use: r.howToUse,
    // created_at uses the DB default.
  };
}

/** results row (snake_case) -> validated Report. `imageUrl` is a pre-signed URL. */
function rowToReport(row: Record<string, unknown>, imageUrl?: string): Report {
  return ReportSchema.parse({
    id: row.id,
    productName: row.product_name ?? "Scanned product",
    scannedOn: formatDate(String(row.created_at)),
    overallScore: Number(row.overall_score),
    verdict: row.verdict,
    summary: row.summary ?? "",
    highlights: row.highlights ?? [],
    cautions: row.cautions ?? [],
    benefits: row.benefits ?? [],
    concernScores: row.concern_scores ?? [],
    ingredients: row.ingredients ?? [],
    howToUse: row.how_to_use ?? "",
    ...(imageUrl ? { imageUrl } : {}),
  });
}

/** Store a report (DB if configured, always in memory) and return its id.
 *  `scanId` links the report to its uploaded photo (Phase C3). */
export async function putReport(report: Report, scanId?: string): Promise<string> {
  reports.set(report.id, report);

  if (isSupabaseConfigured()) {
    const { error } = await getServerSupabase()
      .from(TABLE)
      .insert(reportToRow(report, scanId));
    if (error) {
      console.warn("[report-store] DB insert failed, kept in memory:", error.message);
    }
  }
  return report.id;
}

/** Look up a report by id — from the DB if configured, else in-memory.
 *  When the row links a scan, mints a signed URL for its photo. */
export async function getReport(id: string): Promise<Report | undefined> {
  if (isSupabaseConfigured()) {
    // Embed the linked scan's image path via the results.scan_id foreign key.
    const { data, error } = await getServerSupabase()
      .from(TABLE)
      .select("*, scans(image_url)")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[report-store] DB read failed, trying memory:", error.message);
    } else if (data) {
      try {
        const scan = data.scans as { image_url?: string } | null;
        const imageUrl = scan?.image_url
          ? (await signScanUrl(scan.image_url)) ?? undefined
          : undefined;
        return rowToReport(data, imageUrl);
      } catch (err) {
        console.warn("[report-store] stored row failed validation:", err);
      }
    }
  }
  return reports.get(id);
}
