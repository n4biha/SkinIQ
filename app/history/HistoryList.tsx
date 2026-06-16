"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HistoryItem } from "@/lib/report-store";
import { CATEGORY_LABELS } from "@/lib/category";
import styles from "./history.module.css";

type SortKey = "date" | "score-desc" | "score-asc";
type VerdictFilter = "all" | "Good Match" | "Fair Match" | "Poor Match";

function verdictClass(verdict: string): "good" | "fair" | "poor" {
  if (verdict === "Good Match") return "good";
  if (verdict === "Fair Match") return "fair";
  return "poor";
}

export default function HistoryList({ items }: { items: HistoryItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<VerdictFilter>("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      const matchesQuery = !q || i.productName.toLowerCase().includes(q);
      const matchesVerdict = verdict === "all" || i.verdict === verdict;
      return matchesQuery && matchesVerdict;
    });
    return [...list].sort((a, b) => {
      if (sort === "score-desc") return b.overallScore - a.overallScore;
      if (sort === "score-asc") return a.overallScore - b.overallScore;
      // "date": newest first by ISO timestamp (falls back to server order).
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
  }, [items, query, verdict, sort]);

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/reports/${id}`, { method: "DELETE" });
      setConfirmId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    setBusy(true);
    try {
      await fetch("/api/reports", { method: "DELETE" });
      setConfirmClear(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No scans yet</p>
        <p className={styles.emptyBody}>Scan your first product to see it here.</p>
        <Link href="/scan" className="btn btn-primary">
          Scan a product →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.controls}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={styles.select}
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as VerdictFilter)}
            aria-label="Filter by match"
          >
            <option value="all">All matches</option>
            <option value="Good Match">Good match</option>
            <option value="Fair Match">Fair match</option>
            <option value="Poor Match">Poor match</option>
          </select>
          <select
            className={styles.select}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort by"
          >
            <option value="date">Date added</option>
            <option value="score-desc">Highest score</option>
            <option value="score-asc">Lowest score</option>
          </select>
        </div>

        <div className={styles.actions}>
          <span className={styles.count}>
            {visible.length} {visible.length === 1 ? "product" : "products"}
          </span>
          {confirmClear ? (
            <span className={styles.confirmRow}>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={busy}
                onClick={handleClearAll}
              >
                Clear all
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={busy}
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setConfirmClear(true)}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No matches</p>
          <p className={styles.emptyBody}>Try a different search or filter.</p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {visible.map((item) => (
            <li key={item.id} className={styles.cardWrap}>
              <Link href={`/report/${item.id}`} className={styles.card}>
                <div className={styles.thumb}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={`${item.productName} label`}
                      className={styles.thumbImg}
                    />
                  ) : (
                    <svg viewBox="0 0 48 64" width="34" height="46" fill="none" aria-hidden>
                      <rect x="12" y="2" width="24" height="10" rx="2" fill="var(--green-soft)" stroke="var(--green)" strokeWidth="1.5" />
                      <rect x="8" y="12" width="32" height="50" rx="4" fill="#fff" stroke="var(--border)" strokeWidth="1.5" />
                      <rect x="13" y="26" width="22" height="24" rx="3" fill="var(--green-soft)" />
                    </svg>
                  )}
                </div>
                <div className={styles.body}>
                  <span className={`${styles.badge} ${styles[verdictClass(item.verdict)]}`}>
                    {item.verdict}
                  </span>
                  <h2 className={styles.name}>{item.productName}</h2>
                  <p className={styles.cardCategory}>{CATEGORY_LABELS[item.category]}</p>
                  <p className={styles.meta}>Added {item.scannedOn}</p>
                  <p className={styles.score}>
                    {item.overallScore.toFixed(1)} <span className={styles.scoreMax}>/ 10</span>
                  </p>
                </div>
              </Link>

              {confirmId === item.id ? (
                <div className={styles.cardConfirm}>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={busy}
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    disabled={busy}
                    onClick={() => setConfirmId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  aria-label={`Delete ${item.productName}`}
                  onClick={() => setConfirmId(item.id)}
                >
                  <TrashIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
