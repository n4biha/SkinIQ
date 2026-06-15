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
import { signScanUrl, signScanUrls } from "@/lib/storage";
import { ReportSchema, type Report, type Verdict } from "@/lib/types";

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
function reportToRow(r: Report, opts: { ownerId?: string; scanId?: string }) {
  return {
    id: r.id,
    user_id: opts.ownerId ?? null,
    scan_id: opts.scanId ?? null,
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

/** Store a report. Always kept in memory (covers same-process reads). Persisted to
 *  the DB only for a signed-in user (`opts.ownerId`) — guests' scans don't save.
 *  `opts.scanId` links the report to its uploaded photo (Phase C3). */
export async function putReport(
  report: Report,
  opts: { ownerId?: string; scanId?: string } = {},
): Promise<string> {
  reports.set(report.id, report);

  if (isSupabaseConfigured() && opts.ownerId) {
    const { error } = await getServerSupabase()
      .from(TABLE)
      .insert(reportToRow(report, opts));
    if (error) {
      console.warn("[report-store] DB insert failed, kept in memory:", error.message);
    }
  }
  return report.id;
}

/** Lightweight projection for the History feed. */
export type HistoryItem = {
  id: string;
  productName: string;
  scannedOn: string;
  overallScore: number;
  verdict: Verdict;
  imageUrl?: string;
};

/** List a user's past reports, newest first. Returns [] for guests when a DB is
 *  configured (their scans aren't saved). Falls back to the in-memory list when
 *  Supabase isn't configured (local dev without a DB). */
export async function listReports(ownerId?: string, limit = 50): Promise<HistoryItem[]> {
  if (isSupabaseConfigured()) {
    if (!ownerId) return [];
    const { data, error } = await getServerSupabase()
      .from(TABLE)
      .select("id, product_name, overall_score, verdict, created_at, scans(image_url)")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[report-store] list query failed, trying memory:", error.message);
    } else if (data) {
      const paths = data
        .map((r) => (r.scans as { image_url?: string } | null)?.image_url)
        .filter((p): p is string => Boolean(p));
      const signed = await signScanUrls(paths);
      return data.map((r) => {
        const path = (r.scans as { image_url?: string } | null)?.image_url;
        return {
          id: r.id as string,
          productName: (r.product_name as string) ?? "Scanned product",
          scannedOn: formatDate(String(r.created_at)),
          overallScore: Number(r.overall_score),
          verdict: r.verdict as Verdict,
          imageUrl: path ? signed.get(path) : undefined,
        };
      });
    }
  }
  // Fallback: in-memory, most-recent-first.
  return [...reports.values()].reverse().slice(0, limit).map((r) => ({
    id: r.id,
    productName: r.productName,
    scannedOn: r.scannedOn,
    overallScore: r.overallScore,
    verdict: r.verdict,
    imageUrl: r.imageUrl,
  }));
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
