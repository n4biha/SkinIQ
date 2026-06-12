"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Stepper from "@/components/Stepper";
import styles from "./onboarding.module.css";

type SkinType = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const SKIN_TYPES: SkinType[] = [
  { id: "oily", label: "Oily", icon: <DropIcon /> },
  { id: "dry", label: "Dry", icon: <SunIcon /> },
  { id: "combination", label: "Combination", icon: <SplitIcon /> },
  { id: "sensitive", label: "Sensitive", icon: <SparkIcon /> },
  { id: "not-sure", label: "Not sure", icon: <QuestionIcon /> },
];

const CONCERNS = [
  "Acne",
  "Redness",
  "Dark spots",
  "Dryness",
  "Sensitivity",
  "Fine lines",
];

export default function OnboardingPage() {
  const [skinType, setSkinType] = useState<string | null>("combination");
  const [concerns, setConcerns] = useState<string[]>(["Acne"]);

  function toggleConcern(c: string) {
    setConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  return (
    <div className={styles.page}>
      <Stepper current={1} />

      <div className={styles.grid}>
        {/* Left column */}
        <div className={styles.left}>
          <h1 className={styles.heading}>
            Let&apos;s build your <span className={styles.leaf}>skin profile</span>
          </h1>
          <p className={styles.subtext}>
            Your answers help us personalize product reviews for your unique skin.
          </p>

          <section className={styles.section}>
            <h2 className={styles.question}>What is your skin type?</h2>
            <div className={styles.tileGrid}>
              {SKIN_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.tile} ${
                    skinType === t.id ? styles.tileSelected : ""
                  }`}
                  aria-pressed={skinType === t.id}
                  onClick={() => setSkinType(t.id)}
                >
                  <span className={styles.tileIcon}>{t.icon}</span>
                  <span className={styles.tileLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className={styles.right}>
          <Illustration />

          <section className={styles.section}>
            <h2 className={styles.question}>
              What are your main skin concerns?{" "}
              <span className={styles.hint}>(Select all that apply)</span>
            </h2>
            <div className={styles.chips}>
              {CONCERNS.map((c) => {
                const selected = concerns.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.chip} ${
                      selected ? styles.chipSelected : ""
                    }`}
                    aria-pressed={selected}
                    onClick={() => toggleConcern(c)}
                  >
                    {selected && <CheckIcon />}
                    {c}
                  </button>
                );
              })}
              <button type="button" className={styles.chipAdd}>
                + Add other concern
              </button>
            </div>
          </section>

          <div className={styles.actions}>
            {/* Real <a href> so it navigates natively, with or without JS.
                Phase B: intercept to persist the profile before routing. */}
            <Link href="/scan" className="btn btn-primary">
              Continue →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Icons ---- */

function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" opacity="0.18" />
      <path d="M12 4v16" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M12 3c.6 3.6 1.8 4.8 5.4 5.4-3.6.6-4.8 1.8-5.4 5.4-.6-3.6-1.8-4.8-5.4-5.4C10.2 7.8 11.4 6.6 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18 14c.3 1.8.9 2.4 2.7 2.7-1.8.3-2.4.9-2.7 2.7-.3-1.8-.9-2.4-2.7-2.7 1.8-.3 2.4-.9 2.7-2.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.5 9.5a2.5 2.5 0 0 1 4.6 1.3c0 1.7-2.6 2-2.6 3.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="11.5" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Illustration() {
  return (
    <div className={styles.illustration}>
      <Image
        src="/skin-profile.png"
        alt="A person gently caring for their skin"
        fill
        priority
        sizes="(max-width: 860px) 100vw, 480px"
        className={styles.illustrationImg}
      />
    </div>
  );
}
