"use client";

/**
 * Report toolbar (owner view). Rescan is always available; Share is shown only to
 * the report's owner. Sharing is opt-in and uses a separate unguessable token (the
 * /share/<token> link), never the raw report id — and the owner can disable it.
 */

import { useState } from "react";
import Link from "next/link";
import styles from "./report.module.css";

type Props = {
  reportId: string;
  /** True only when the viewer owns this (persisted) report. */
  canShare: boolean;
  /** Existing token if the report is already shared. */
  initialShareToken?: string;
};

export default function ReportActions({ reportId, canShare, initialShareToken }: Props) {
  const [token, setToken] = useState<string | null>(initialShareToken ?? null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/share/${token}`
      : "";

  async function enableShare() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/share`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.token) {
        setToken(data.token);
        setOpen(true);
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
      setOpen(false);
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

  function onShareClick() {
    if (token) setOpen((o) => !o);
    else void enableShare();
  }

  return (
    <div className={styles.actionsWrap}>
      <div className={styles.topActions}>
        <Link href="/scan" className="btn btn-secondary">
          <RescanIcon /> Rescan
        </Link>
        {canShare && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onShareClick}
            disabled={busy}
          >
            <ShareIcon /> {token ? "Share link" : "Share"}
          </button>
        )}
      </div>

      {canShare && open && token && (
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
