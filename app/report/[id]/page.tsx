import Link from "next/link";
import Stepper from "@/components/Stepper";
import ScoreHeader from "@/components/ScoreHeader";
import ResultTabs from "@/components/ResultTabs";
import { MOCK_REPORT } from "@/lib/mockReport";
import { getReport } from "@/lib/report-store";
import styles from "./report.module.css";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Real scans are stored by /api/analyze. Fall back to the mock so /report/sample
  // (and reloads after a dev-server restart, when the in-memory store is empty)
  // still render instead of 404ing.
  const report = getReport(id) ?? MOCK_REPORT;

  return (
    <div className={styles.page}>
      <Stepper current={4} />

      <div className={styles.topActions}>
        <Link href="/scan" className="btn btn-secondary">
          <RescanIcon /> Rescan
        </Link>
        <button type="button" className="btn btn-secondary">
          <BookmarkIcon /> Save product
        </button>
        <button type="button" className="btn btn-secondary">
          <ShareIcon /> Share
        </button>
      </div>

      <ScoreHeader report={report} />

      <ResultTabs report={report} />

      <div className={styles.howToUse}>
        <div className={styles.howIcon}>
          <InfoIcon />
        </div>
        <div>
          <h3 className={styles.howTitle}>How to use</h3>
          <p className={styles.howBody}>{report.howToUse}</p>
        </div>
      </div>

      <p className={styles.disclaimer}>
        Informational only — not medical advice. Patch-test new products and
        consult a dermatologist for any skin concerns.
      </p>
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

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path d="M6 4h12v16l-6-4-6 4V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}
