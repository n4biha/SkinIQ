"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import styles from "./login.module.css";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Saved on the account at first sign-up (stored in user metadata).
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Sign in to SkinIQ</h1>

        {status === "sent" ? (
          <div className={styles.sent}>
            <p className={styles.sentTitle}>Check your email</p>
            <p className={styles.sentBody}>
              We sent a magic link to <strong>{email}</strong>. Click it to sign
              in — you can close this tab.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStatus("idle")}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className={styles.form}>
            <p className={styles.subtext}>
              Enter your details and we&apos;ll send a one-time sign-in link — no
              password needed. (Name is saved when you first create your account.)
            </p>
            <div className={styles.nameRow}>
              <div className={styles.nameField}>
                <label className={styles.label} htmlFor="firstName">
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Ada"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.nameField}>
                <label className={styles.label} htmlFor="lastName">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Lovelace"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send magic link →"}
            </button>

            <Link href="/onboarding" className={styles.guestLink}>
              Continue without signing in
            </Link>
            <p className={styles.guestNote}>
              Without an account your scans won&apos;t be saved to your history.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
