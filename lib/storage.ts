/**
 * Supabase Storage helpers (Phase C · C3).
 *
 * Uploaded label photos go into the PRIVATE `scans` bucket (not world-readable).
 * To display one, the server mints a short-lived signed URL at render time —
 * matching the app's "private and secure" promise.
 *
 * Everything is best-effort: any failure logs and returns null so a scan still
 * succeeds (the report just shows the placeholder instead of the photo).
 */

import { getServerSupabase } from "@/lib/supabase";

const BUCKET = "scans";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
};

/**
 * Upload a base64 image to the `scans` bucket and record a `scans` row.
 * Returns the new scan id (so the caller can link it on the result), or null.
 */
export async function saveScan(
  base64: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const sb = getServerSupabase();
    const scanId = crypto.randomUUID();
    const ext = EXT_BY_MIME[mimeType] ?? "bin";
    const path = `${scanId}.${ext}`;
    const buffer = Buffer.from(base64, "base64");

    const up = await sb.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mimeType, upsert: true });
    if (up.error) {
      console.warn("[storage] image upload failed:", up.error.message);
      return null;
    }

    // image_url holds the storage PATH (private bucket — we sign it on read).
    const { error } = await sb.from("scans").insert({ id: scanId, image_url: path });
    if (error) {
      console.warn("[storage] scans insert failed:", error.message);
      return null;
    }
    return scanId;
  } catch (err) {
    console.warn("[storage] saveScan error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Batch-sign many scan paths in one call → a path→url map (best-effort). */
export async function signScanUrls(
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  try {
    const { data, error } = await getServerSupabase()
      .storage.from(BUCKET)
      .createSignedUrls(paths, expiresIn);
    if (error) {
      console.warn("[storage] signScanUrls failed:", error.message);
      return map;
    }
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    }
  } catch (err) {
    console.warn("[storage] signScanUrls error:", err instanceof Error ? err.message : err);
  }
  return map;
}

/** Mint a temporary signed URL for a stored scan path (or null on failure). */
export async function signScanUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  try {
    const { data, error } = await getServerSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) {
      console.warn("[storage] signScanUrl failed:", error.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn("[storage] signScanUrl error:", err instanceof Error ? err.message : err);
    return null;
  }
}
