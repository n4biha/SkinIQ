"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Stepper from "@/components/Stepper";
import { useProfile } from "@/lib/profile-context";
import type { SkinType } from "@/lib/types";
import styles from "./onboarding.module.css";

type SkinTypeTile = {
  id: SkinType;
  label: string;
  icon: React.ReactNode;
};

const SKIN_TYPES: SkinTypeTile[] = [
  { id: "oily", label: "Oily", icon: <DropIcon /> },
  { id: "dry", label: "Dry", icon: <SunIcon /> },
  { id: "combination", label: "Combination", icon: <SplitIcon /> },
  { id: "not-sure", label: "Not sure", icon: <QuestionIcon /> },
];

const CONCERNS = [
  "Acne",
  "Redness",
  "Dark spots",
  "Dryness",
  "Fine lines",
];

export default function OnboardingPage() {
  // Selections persist immediately via the profile context (localStorage + DB).
  const { profile, setSkinType, setSensitive, toggleConcern, addAllergy, removeAllergy } =
    useProfile();
  const skinType = profile.skinType;
  const concerns = profile.concerns;

  // Concerns the user typed themselves (not one of the preset chips).
  const customConcerns = concerns.filter((c) => !CONCERNS.includes(c));

  const [showConcernInput, setShowConcernInput] = useState(false);
  const [concernDraft, setConcernDraft] = useState("");
  const [allergyDraft, setAllergyDraft] = useState("");

  function commitConcern() {
    const value = concernDraft.trim();
    if (value && !concerns.some((c) => c.toLowerCase() === value.toLowerCase())) {
      toggleConcern(value);
    }
    setConcernDraft("");
    setShowConcernInput(false);
  }

  function commitAllergy() {
    addAllergy(allergyDraft);
    setAllergyDraft("");
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

          <section className={styles.section}>
            <h2 className={styles.question}>Is your skin sensitive?</h2>
            <p className={styles.subtext}>
              Choose this in addition to your skin type if your skin is easily
              irritated or reactive.
            </p>
            <div className={styles.chips}>
              <button
                type="button"
                className={`${styles.chip} ${
                  profile.sensitive ? styles.chipSelected : ""
                }`}
                aria-pressed={profile.sensitive}
                onClick={() => setSensitive(!profile.sensitive)}
              >
                {profile.sensitive && <CheckIcon />}
                Sensitive skin
              </button>
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

              {/* Custom concerns the user added — click to remove. */}
              {customConcerns.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.chip} ${styles.chipSelected}`}
                  aria-pressed
                  onClick={() => toggleConcern(c)}
                >
                  <CheckIcon />
                  {c}
                </button>
              ))}

              {showConcernInput ? (
                <input
                  type="text"
                  className={styles.addInput}
                  placeholder="Type a concern…"
                  autoFocus
                  autoComplete="off"
                  value={concernDraft}
                  onChange={(e) => setConcernDraft(e.target.value)}
                  onBlur={commitConcern}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitConcern();
                    } else if (e.key === "Escape") {
                      setConcernDraft("");
                      setShowConcernInput(false);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.chipAdd}
                  onClick={() => setShowConcernInput(true)}
                >
                  + Add other concern
                </button>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.question}>
              Any ingredient allergies?{" "}
              <span className={styles.hint}>(optional)</span>
            </h2>
            <p className={styles.subtext}>
              We&apos;ll flag these on every product you scan.
            </p>
            <form
              className={styles.addForm}
              onSubmit={(e) => {
                e.preventDefault();
                commitAllergy();
              }}
            >
              <input
                type="text"
                className={styles.addInput}
                placeholder="e.g. fragrance, linalool"
                autoComplete="off"
                value={allergyDraft}
                onChange={(e) => setAllergyDraft(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!allergyDraft.trim()}
              >
                Add
              </button>
            </form>
            {profile.allergies.length > 0 && (
              <div className={styles.chips}>
                {profile.allergies.map((a) => (
                  <span key={a} className={styles.tagChip}>
                    {a}
                    <button
                      type="button"
                      className={styles.tagRemove}
                      aria-label={`Remove ${a}`}
                      onClick={() => removeAllergy(a)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
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
