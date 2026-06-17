import type { ConcernScore } from "@/lib/types";
import styles from "./ConcernBars.module.css";

export default function ConcernBars({ scores }: { scores: ConcernScore[] }) {
  return (
    <div className={styles.bars}>
      {scores.map((s) => {
        // Custom (free-text) concerns are AI-judged; an all-neutral one is tracked
        // but didn't move the score, so we show "not scored" instead of a bar.
        const notScored = s.scored === false;
        return (
          <div key={s.label} className={styles.row}>
            <div className={styles.top}>
              <span className={styles.label}>
                {s.label}
                {s.aiAssessed && <span className={styles.aiTag}>AI-assessed</span>}
              </span>
              <span className={styles.percent}>
                {notScored ? "tracked, not scored" : `${s.percent}%`}
              </span>
            </div>
            {!notScored && (
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${s.percent}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
