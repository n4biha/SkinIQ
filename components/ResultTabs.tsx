"use client";

import { useState } from "react";
import type { Report } from "@/lib/types";
import ConcernBars from "./ConcernBars";
import styles from "./ResultTabs.module.css";

const TABS = [
  "Overview",
  "Ingredients",
  "Benefits",
  "Concerns",
  "Full Analysis",
] as const;
type Tab = (typeof TABS)[number];

const FLAG_LABEL: Record<string, string> = {
  good: "Beneficial",
  caution: "Watch",
  flag: "Flag",
};

export default function ResultTabs({ report }: { report: Report }) {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {tab === "Overview" && (
          <div className={styles.overview}>
            <section className={styles.col}>
              <h3 className={`${styles.colTitle} ${styles.good}`}>
                <HeartIcon /> Why it&apos;s a good match
              </h3>
              <ul className={styles.list}>
                {report.highlights.map((h) => (
                  <li key={h} className={styles.listItem}>
                    <span className={`${styles.bullet} ${styles.bulletGood}`}>
                      <CheckIcon />
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.col}>
              <h3 className={`${styles.colTitle} ${styles.caution}`}>
                <WarnIcon /> Potential concerns
              </h3>
              <ul className={styles.list}>
                {report.cautions.map((c) => (
                  <li key={c} className={styles.listItem}>
                    <span className={`${styles.bullet} ${styles.bulletCaution}`}>
                      !
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.col}>
              <h3 className={styles.colTitle}>Best for your concerns</h3>
              <ConcernBars scores={report.concernScores} />
            </section>
          </div>
        )}

        {tab === "Ingredients" && (
          <ul className={styles.ingredients}>
            {report.ingredients.map((ing) => (
              <li key={ing.name} className={styles.ingredient}>
                <div className={styles.ingTop}>
                  <span className={styles.ingName}>{ing.name}</span>
                  {ing.flag && (
                    <span className={`${styles.tag} ${styles[`tag_${ing.flag}`]}`}>
                      {FLAG_LABEL[ing.flag]}
                    </span>
                  )}
                </div>
                <span className={styles.ingFn}>{ing.function}</span>
                <p className={styles.ingNote}>{ing.note}</p>
              </li>
            ))}
          </ul>
        )}

        {tab === "Benefits" && (
          <ul className={styles.list}>
            {report.benefits.map((b) => (
              <li key={b} className={styles.listItem}>
                <span className={`${styles.bullet} ${styles.bulletGood}`}>
                  <CheckIcon />
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}

        {tab === "Concerns" && (
          <ul className={styles.list}>
            {report.cautions.map((c) => (
              <li key={c} className={styles.listItem}>
                <span className={`${styles.bullet} ${styles.bulletCaution}`}>!</span>
                {c}
              </li>
            ))}
          </ul>
        )}

        {tab === "Full Analysis" && (
          <div className={styles.full}>
            <p className={styles.fullSummary}>{report.summary}.</p>
            <ConcernBars scores={report.concernScores} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Icons ---- */

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6c0 5-7 9.4-7 9.4Z"
        fill="currentColor"
        opacity="0.18"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M12 4 2.5 20h19L12 4Z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
