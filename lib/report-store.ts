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

import { randomBytes } from "node:crypto";
import { isSupabaseConfigured, getServerSupabase } from "@/lib/supabase";
import { signScanUrl, signScanUrls, removeScans } from "@/lib/storage";
import { ReportSchema, type Report, type Verdict } from "@/lib/types";

// In-memory fallback + same-process cache, kept across hot-reloads. We keep the
// owner alongside the report so the same private-by-default rule applies whether
// a report is served from the DB or memory.
type StoredReport = { report: Report; ownerId?: string };
const globalForReports = globalThis as unknown as {
  __skiniqReports?: Map<string, StoredReport>;
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
  reports.set(report.id, { report, ownerId: opts.ownerId });

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
  /** Raw ISO timestamp (DB only) — used for sorting by date added. */
  createdAt?: string;
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
          createdAt: String(r.created_at),
          overallScore: Number(r.overall_score),
          verdict: r.verdict as Verdict,
          imageUrl: path ? signed.get(path) : undefined,
        };
      });
    }
  }
  // Fallback: in-memory, most-recent-first.
  return [...reports.values()].reverse().slice(0, limit).map(({ report: r }) => ({
    id: r.id,
    productName: r.productName,
    scannedOn: r.scannedOn,
    overallScore: r.overallScore,
    verdict: r.verdict,
    imageUrl: r.imageUrl,
  }));
}

/** A report plus who owns it (for private-by-default access) and its share token. */
export type OwnedReport = { report: Report; ownerId?: string; shareToken?: string };

/** Look up a report by id — from the DB if configured, else in-memory. Returns the
 *  owner id so the caller can enforce owner-only access. Mints a signed photo URL. */
export async function getReport(id: string): Promise<OwnedReport | undefined> {
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
        return {
          report: rowToReport(data, imageUrl),
          ownerId: (data.user_id as string) ?? undefined,
          shareToken: (data.share_token as string) ?? undefined,
        };
      } catch (err) {
        console.warn("[report-store] stored row failed validation:", err);
      }
    }
  }
  const mem = reports.get(id);
  return mem ? { report: mem.report, ownerId: mem.ownerId } : undefined;
}

/** A report fetched by its public share token (read-only; no owner check). */
export async function getReportByShareToken(token: string): Promise<Report | undefined> {
  if (!isSupabaseConfigured() || !token) return undefined;
  const { data, error } = await getServerSupabase()
    .from(TABLE)
    .select("*, scans(image_url)")
    .eq("share_token", token)
    .maybeSingle();
  if (error) {
    console.warn("[report-store] share lookup failed:", error.message);
    return undefined;
  }
  if (!data) return undefined;
  try {
    const scan = data.scans as { image_url?: string } | null;
    const imageUrl = scan?.image_url
      ? (await signScanUrl(scan.image_url)) ?? undefined
      : undefined;
    return rowToReport(data, imageUrl);
  } catch (err) {
    console.warn("[report-store] shared row failed validation:", err);
    return undefined;
  }
}

/** Enable sharing: return the report's share token (creating one if needed).
 *  Owner-scoped; null if the report isn't this user's or the DB isn't available. */
export async function createShareToken(
  id: string,
  ownerId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select("share_token")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error || !data) return null; // not found or not the owner

  const existing = (data as { share_token?: string }).share_token;
  if (existing) return existing; // already shared — idempotent

  const token = randomBytes(32).toString("base64url"); // unguessable, not the id
  const { error: upErr } = await sb
    .from(TABLE)
    .update({ share_token: token })
    .eq("id", id)
    .eq("user_id", ownerId);
  if (upErr) {
    console.warn("[report-store] share create failed:", upErr.message);
    return null;
  }
  return token;
}

/** Disable sharing: clear the share token for this owner's report. */
export async function revokeShareToken(id: string, ownerId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getServerSupabase()
    .from(TABLE)
    .update({ share_token: null })
    .eq("id", id)
    .eq("user_id", ownerId);
  if (error) {
    console.warn("[report-store] share revoke failed:", error.message);
    return false;
  }
  return true;
}

/** Delete one of a user's reports, plus its linked scan row + stored photo.
 *  Owner-scoped (service-role bypasses RLS). Best-effort; returns success. */
export async function deleteReport(id: string, ownerId: string): Promise<boolean> {
  reports.delete(id);
  if (!isSupabaseConfigured()) return true;

  const sb = getServerSupabase();
  // Find the linked scan + image path before deleting (owner-scoped).
  const { data } = await sb
    .from(TABLE)
    .select("scan_id, scans(image_url)")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();

  const { error } = await sb
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);
  if (error) {
    console.warn("[report-store] delete failed:", error.message);
    return false;
  }

  const scanId = (data as { scan_id?: string } | null)?.scan_id;
  const path = (data?.scans as { image_url?: string } | null)?.image_url;
  if (scanId) {
    await sb.from("scans").delete().eq("id", scanId).eq("user_id", ownerId);
  }
  if (path) await removeScans([path]);
  return true;
}

/** Delete ALL of a user's reports, plus their scans + stored photos.
 *  Owner-scoped. Returns how many reports were removed. */
export async function clearReports(ownerId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const n = reports.size;
    reports.clear();
    return n;
  }

  const sb = getServerSupabase();
  const { data, error: readError } = await sb
    .from(TABLE)
    .select("id, scan_id, scans(image_url)")
    .eq("user_id", ownerId);
  if (readError) {
    console.warn("[report-store] clear lookup failed:", readError.message);
    return 0;
  }

  const rows = data ?? [];
  const paths = rows
    .map((r) => (r.scans as { image_url?: string } | null)?.image_url)
    .filter((p): p is string => Boolean(p));
  const scanIds = rows
    .map((r) => r.scan_id as string | null)
    .filter((s): s is string => Boolean(s));

  const { error } = await sb.from(TABLE).delete().eq("user_id", ownerId);
  if (error) {
    console.warn("[report-store] clear failed:", error.message);
    return 0;
  }
  if (scanIds.length) {
    await sb.from("scans").delete().in("id", scanIds).eq("user_id", ownerId);
  }
  if (paths.length) await removeScans(paths);

  // Drop this user's same-process in-memory copies (leave other users' alone).
  for (const r of rows) reports.delete(r.id as string);
  return rows.length;
}
