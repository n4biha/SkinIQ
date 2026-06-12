import type { Report } from "@/lib/types";
import styles from "./ScoreHeader.module.css";

export default function ScoreHeader({ report }: { report: Report }) {
  const pct = Math.round((report.overallScore / 10) * 100);

  return (
    <div className={styles.header}>
      <div className={styles.product}>
        <div className={styles.thumb} aria-hidden>
          <svg viewBox="0 0 48 64" width="44" height="58" fill="none">
            <rect x="12" y="2" width="24" height="10" rx="2" fill="var(--green-soft)" stroke="var(--green)" strokeWidth="1.5" />
            <rect x="8" y="12" width="32" height="50" rx="4" fill="#fff" stroke="var(--border)" strokeWidth="1.5" />
            <rect x="13" y="26" width="22" height="24" rx="3" fill="var(--green-soft)" />
            <rect x="16" y="31" width="16" height="3" rx="1.5" fill="var(--green)" />
            <rect x="16" y="38" width="12" height="3" rx="1.5" fill="var(--green)" opacity="0.6" />
          </svg>
        </div>
        <div>
          <span className={styles.badge}>{report.verdict}</span>
          <h1 className={styles.name}>{report.productName}</h1>
          <p className={styles.scanned}>Scanned on {report.scannedOn}</p>
        </div>
      </div>

      <div className={styles.scoreBlock}>
        <div className={styles.scoreValue}>
          {report.overallScore.toFixed(1)} <span className={styles.scoreMax}>/ 10</span>
        </div>
        <p className={styles.scoreLabel}>Overall match score</p>
        <p className={styles.scoreSub}>{report.summary}</p>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
