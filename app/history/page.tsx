import Link from "next/link";
import { listReports } from "@/lib/report-store";
import { getUser } from "@/lib/supabase-server";
import HistoryList from "./HistoryList";
import styles from "./history.module.css";

export default async function HistoryPage() {
  const user = await getUser();

  // Guests have no saved history — prompt them to sign in to start saving.
  if (!user) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>History</h1>
        <p className={styles.subtext}>Keep a record of every product you scan.</p>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Sign in to save your scans</p>
          <p className={styles.emptyBody}>
            Create a free account and your scanned products will be saved here so
            you can come back to them anytime.
          </p>
          <Link href="/login" className="btn btn-primary">
            Sign in to start saving →
          </Link>
        </div>
      </div>
    );
  }

  const items = await listReports(user.id);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>History</h1>
      <p className={styles.subtext}>Products you&apos;ve scanned, most recent first.</p>

      <HistoryList items={items} />
    </div>
  );
}
