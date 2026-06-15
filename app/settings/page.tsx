"use client";

/**
 * Settings — account, profile, and data management.
 *
 * Auth state comes from the browser Supabase client (same pattern as the sidebar
 * / AccountCard). Destructive actions reuse existing endpoints:
 *   - Clear scan history → DELETE /api/reports
 *   - Delete account     → DELETE /api/account
 * Reset profile clears the context profile, which the profile sync also pushes to
 * the DB for signed-in users.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import { useProfile, EMPTY_PROFILE } from "@/lib/profile-context";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const { setProfile } = useProfile();

  const [email, setEmail] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // which action is running
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Track who's signed in (and keep it live across sign-in/out).
  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setAuthLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signedIn = !!email;

  async function signOut() {
    setBusy("signout");
    await createBrowserSupabase().auth.signOut();
    setBusy(null);
    router.refresh();
  }

  function resetProfile() {
    setProfile(EMPTY_PROFILE); // context sync clears the DB row too (signed-in)
    setNotice("Your skin profile has been reset.");
  }

  async function clearHistory() {
    setBusy("clear");
    try {
      await fetch("/api/reports", { method: "DELETE" });
      setConfirmClear(false);
      setNotice("Scan history cleared.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      await createBrowserSupabase().auth.signOut();
      router.push("/");
    } catch {
      setBusy(null);
      setNotice("Couldn't delete your account. Please try again.");
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>
      <p className={styles.subtext}>Manage your account, profile, and data.</p>

      {notice && <p className={styles.notice}>{notice}</p>}

      {/* Account */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Account</h2>
        {!authLoaded ? (
          <p className={styles.muted}>Loading…</p>
        ) : signedIn ? (
          <div className={styles.row}>
            <span className={styles.value}>{email}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={signOut}
              disabled={busy === "signout"}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className={styles.row}>
            <span className={styles.muted}>You&apos;re not signed in.</span>
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
          </div>
        )}
      </section>

      {/* Skin profile */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Skin profile</h2>
        <p className={styles.muted}>
          Clear your saved skin type, sensitivity, concerns, and allergies.
        </p>
        <div className={styles.row}>
          <button type="button" className="btn btn-secondary" onClick={resetProfile}>
            Reset skin profile
          </button>
          <Link href="/onboarding" className={styles.link}>
            Rebuild profile →
          </Link>
        </div>
      </section>

      {/* Scan history */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Scan history</h2>
        {signedIn ? (
          <>
            <p className={styles.muted}>Delete every product you&apos;ve scanned.</p>
            {confirmClear ? (
              <div className={styles.row}>
                <span>Clear all scans?</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearHistory}
                  disabled={busy === "clear"}
                >
                  Yes, clear
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmClear(false)}
                  disabled={busy === "clear"}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmClear(true)}
              >
                Clear scan history
              </button>
            )}
          </>
        ) : (
          <p className={styles.muted}>Sign in to save and manage scan history.</p>
        )}
      </section>

      {/* Danger zone */}
      {signedIn && (
        <section className={`card ${styles.section} ${styles.danger}`}>
          <h2 className={styles.sectionTitle}>Delete account</h2>
          <p className={styles.muted}>
            Permanently deletes your account and all saved scans, photos, and
            profile. This can&apos;t be undone.
          </p>
          {confirmDelete ? (
            <div className={styles.row}>
              <span>Delete your account permanently?</span>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={deleteAccount}
                disabled={busy === "delete"}
              >
                {busy === "delete" ? "Deleting…" : "Delete account"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={busy === "delete"}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => setConfirmDelete(true)}
            >
              Delete account
            </button>
          )}
        </section>
      )}
    </div>
  );
}
