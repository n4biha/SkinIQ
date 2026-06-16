import { notFound } from "next/navigation";
import Stepper from "@/components/Stepper";
import ResultTabs from "@/components/ResultTabs";
import ReportActions from "./ReportActions";
import { MOCK_REPORT } from "@/lib/mockReport";
import { getReport } from "@/lib/report-store";
import { getUser } from "@/lib/supabase-server";
import type { Report } from "@/lib/types";
import styles from "./report.module.css";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let report: Report;
  let canShare = false;
  let shareToken: string | undefined;

  if (id === "sample") {
    // Public demo report.
    report = MOCK_REPORT;
  } else {
    const [user, found] = await Promise.all([getUser(), getReport(id)]);
    if (!found) notFound();
    // Private by default: an owned report is visible only to its owner.
    if (found.ownerId && found.ownerId !== user?.id) notFound();
    report = found.report;
    canShare = !!found.ownerId && found.ownerId === user?.id;
    shareToken = found.shareToken;
  }

  return (
    <div className={styles.page}>
      <Stepper current={4} />

      {/* ReportActions renders the ScoreHeader so a rename updates it instantly. */}
      <ReportActions
        report={report}
        reportId={id}
        canShare={canShare}
        initialShareToken={shareToken}
      />

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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}
