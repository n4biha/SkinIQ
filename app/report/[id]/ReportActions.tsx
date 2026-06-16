"use client";

/**
 * Report header + owner toolbar.
 *
 * Renders ScoreHeader itself so the product name can update OPTIMISTICALLY on
 * rename: `displayName` is local state, the header + edit input both read from it,
 * and on save we set it before the PATCH and roll back if the request fails.
 *
 * Owner-only actions (Edit name, Share) appear only when the viewer owns the
 * report. Rescan is always available. Sharing uses a separate unguessable token
 * (the /share/<token> link), never the raw report id.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScoreHeader from "@/components/ScoreHeader";
import { ProductCategorySchema, type ProductCategory, type Report } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/category";
import styles from "./report.module.css";

type Props = {
  report: Report;
  reportId: string;
  /** True only when the viewer owns this (persisted) report. */
  canShare: boolean;
  /** Existing token if the report is already shared. */
  initialShareToken?: string;
};

export default function ReportActions({
  report,
  reportId,
  canShare,
  initialShareToken,
}: Props) {
  const router = useRouter();

  // ---- Optimistic product name ----
  const initialProductName = report.productName;
  const [displayName, setDisplayName] = useState(initialProductName);
  const [editing, setEditing] = useState(false);

  // ---- Optimistic category (user-correctable best-effort guess) ----
  const initialCategory = report.category;
  const [displayCategory, setDisplayCategory] = useState<ProductCategory>(initialCategory);

  // ---- Share link ----
  const [token, setToken] = useState<string | null>(initialShareToken ?? null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${token}`
      : "";

  async function saveName() {
    const newName = displayName.trim();
    if (!newName) return;
    setEditing(false);
    setDisplayName(newName); // optimistic — header updates instantly
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productName: newName }),
      });
      if (!res.ok) throw new Error("rename failed");
      router.refresh();
    } catch {
      setDisplayName(initialProductName); // roll back on failure
    }
  }

  function cancelEdit() {
    setDisplayName(initialProductName);
    setEditing(false);
  }

  async function changeCategory(next: ProductCategory) {
    setDisplayCategory(next); // optimistic — chip updates instantly
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: next }),
      });
      if (!res.ok) throw new Error("category update failed");
      router.refresh();
    } catch {
      setDisplayCategory(initialCategory); // roll back on failure
    }
  }

  async function enableShare() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/share`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.token) {
        setToken(data.token);
        setShareOpen(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function disableShare() {
    setBusy(true);
    try {
      await fetch(`/api/reports/${reportId}/share`, { method: "DELETE" });
      setToken(null);
      setShareOpen(false);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the input is selectable for manual copy.
    }
  }

  return (
    <>
      <div className={styles.actionsWrap}>
        <div className={styles.topActions}>
          <Link href="/scan" className="btn btn-secondary">
            <RescanIcon /> Rescan
          </Link>
          {canShare && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditing((e) => !e)}
            >
              <PencilIcon /> Edit name
            </button>
          )}
          {canShare && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => (token ? setShareOpen((o) => !o) : void enableShare())}
              disabled={busy}
            >
              <ShareIcon /> {token ? "Share link" : "Share"}
            </button>
          )}
        </div>

        {canShare && (
          <label className={styles.categoryRow}>
            <span className={styles.categoryLabel}>Category</span>
            <select
              className={styles.categorySelect}
              value={displayCategory}
              onChange={(e) => changeCategory(e.target.value as ProductCategory)}
            >
              {ProductCategorySchema.options.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        )}

        {editing && (
          <div className={styles.renameRow}>
            <input
              className={styles.renameInput}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveName();
                else if (e.key === "Escape") cancelEdit();
              }}
              aria-label="Product name"
              autoFocus
            />
            <button type="button" className="btn btn-primary" onClick={saveName}>
              Save
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        )}

        {canShare && shareOpen && token && (
          <div className={styles.shareBox}>
            <p className={styles.shareNote}>
              Anyone with this link can view a read-only copy of this report.
            </p>
            <div className={styles.shareRow}>
              <input
                className={styles.shareInput}
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn btn-secondary" onClick={copyLink}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              className={styles.disableLink}
              onClick={disableShare}
              disabled={busy}
            >
              Disable link
            </button>
          </div>
        )}
      </div>

      {/* Header reads the optimistic name + category so edits show instantly. */}
      <ScoreHeader
        report={{ ...report, productName: displayName, category: displayCategory }}
      />
    </>
  );
}

/* ---- Icons ---- */

function RescanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M20 11a8 8 0 0 0-14-4.5L4 9M4 13a8 8 0 0 0 14 4.5L20 15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2 4 20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
