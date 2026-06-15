"use client";

import Link from "next/link";
import { useProfile } from "@/lib/profile-context";
import type { SkinType } from "@/lib/types";
import AccountCard from "./AccountCard";
import styles from "./profile.module.css";

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: "Oily",
  dry: "Dry",
  combination: "Combination",
  sensitive: "Sensitive",
  "not-sure": "Not sure",
};

export default function ProfilePage() {
  const { profile, hydrated } = useProfile();

  // Avoid a flash of the empty state before localStorage is read.
  if (!hydrated) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Profile</h1>
      </div>
    );
  }

  const hasProfile =
    profile.skinType !== null ||
    profile.concerns.length > 0 ||
    profile.allergies.length > 0;

  if (!hasProfile) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Profile</h1>
        <AccountCard />
        <p className={styles.subtext}>You haven&apos;t set up your skin profile yet.</p>
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            Build your skin profile so we can personalize every ingredient review.
          </p>
          <Link href="/onboarding" className="btn btn-primary">
            Build your profile →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>Profile</h1>
          <p className={styles.subtext}>Your account and saved skin profile.</p>
        </div>
        <Link href="/onboarding" className="btn btn-secondary">
          Edit profile
        </Link>
      </div>

      <AccountCard />

      <section className={`card ${styles.card}`}>
        <h2 className={styles.label}>Skin type</h2>
        {profile.skinType ? (
          <span className={styles.chip}>{SKIN_TYPE_LABELS[profile.skinType]}</span>
        ) : (
          <p className={styles.muted}>Not set</p>
        )}
      </section>

      <section className={`card ${styles.card}`}>
        <h2 className={styles.label}>Main concerns</h2>
        {profile.concerns.length > 0 ? (
          <div className={styles.chips}>
            {profile.concerns.map((c) => (
              <span key={c} className={styles.chip}>
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>None selected</p>
        )}
      </section>

      <section className={`card ${styles.card}`}>
        <h2 className={styles.label}>Ingredient allergies</h2>
        {profile.allergies.length > 0 ? (
          <div className={styles.chips}>
            {profile.allergies.map((a) => (
              <span key={a} className={styles.chip}>
                {a}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>None added</p>
        )}
      </section>
    </div>
  );
}
