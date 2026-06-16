/**
 * Public, read-only shared report (Phase C · hardening).
 *
 * Reached only via an unguessable share token (NOT the report id). Renders the
 * same score + tabs as the owner's report but with no actions/editing. Returns
 * 404 for an unknown/revoked token.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import ScoreHeader from "@/components/ScoreHeader";
import ResultTabs from "@/components/ResultTabs";
import { getReportByShareToken } from "@/lib/report-store";
import styles from "@/app/report/[id]/report.module.css";

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getReportByShareToken(token);
  if (!report) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.sharedHeader}>
        <span className={styles.sharedBadge}>Shared SkinIQ report</span>
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

      <p className={styles.sharedCta}>
        <Link href="/">Analyze your own products with SkinIQ →</Link>
      </p>
    </div>
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
