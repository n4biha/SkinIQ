import styles from "./Stepper.module.css";

export type StepNumber = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1, label: "Skin profile" },
  { n: 2, label: "Scan product" },
  { n: 3, label: "Analyzing" },
  { n: 4, label: "Results" },
] as const;

const CHECK = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
    <path
      d="M5 12.5 10 17.5 19 7"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Pure presentational 4-step progress indicator. `current` is the active step. */
export default function Stepper({ current }: { current: StepNumber }) {
  return (
    <ol className={styles.stepper}>
      {STEPS.map((step, i) => {
        const state =
          step.n < current ? "done" : step.n === current ? "current" : "future";
        return (
          <li key={step.n} className={styles.item}>
            <span className={`${styles.marker} ${styles[state]}`}>
              {state === "done" ? CHECK : step.n}
            </span>
            <span className={`${styles.label} ${styles[`${state}Label`]}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={`${styles.connector} ${
                  step.n < current ? styles.connectorDone : ""
                }`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
