import type { ConcernScore } from "@/lib/mockReport";
import styles from "./ConcernBars.module.css";

export default function ConcernBars({ scores }: { scores: ConcernScore[] }) {
  return (
    <div className={styles.bars}>
      {scores.map((s) => (
        <div key={s.label} className={styles.row}>
          <div className={styles.top}>
            <span className={styles.label}>{s.label}</span>
            <span className={styles.percent}>{s.percent}%</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${s.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
