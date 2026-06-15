"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import styles from "./profile.module.css";

type Account = { email?: string; firstName?: string; lastName?: string };

export default function AccountCard() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setAccount(
        u
          ? {
              email: u.email,
              firstName: u.user_metadata?.first_name,
              lastName: u.user_metadata?.last_name,
            }
          : null,
      );
      setLoaded(true);
    });
  }, []);

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.refresh();
    router.push("/");
  }

  if (!loaded) return null;

  if (!account) {
    return (
      <section className={`card ${styles.card} ${styles.account}`}>
        <h2 className={styles.label}>Account</h2>
        <p className={styles.muted}>You&apos;re not signed in.</p>
        <Link href="/login" className="btn btn-secondary">
          Sign in
        </Link>
      </section>
    );
  }

  const name = [account.firstName, account.lastName].filter(Boolean).join(" ");

  return (
    <section className={`card ${styles.card} ${styles.account}`}>
      <h2 className={styles.label}>Account</h2>
      {name && <p className={styles.accountName}>{name}</p>}
      <p className={styles.accountEmail}>{account.email}</p>
      <button type="button" className="btn btn-secondary" onClick={signOut}>
        Sign out
      </button>
    </section>
  );
}
