import Link from "next/link";
import { listReports } from "@/lib/report-store";
import { getUser } from "@/lib/supabase-server";
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

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No scans yet</p>
          <p className={styles.emptyBody}>Scan your first product to see it here.</p>
          <Link href="/scan" className="btn btn-primary">
            Scan a product →
          </Link>
        </div>
      ) : (
        <ul className={styles.grid}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/report/${item.id}`} className={styles.card}>
                <div className={styles.thumb}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={`${item.productName} label`}
                      className={styles.thumbImg}
                    />
                  ) : (
                    <svg viewBox="0 0 48 64" width="34" height="46" fill="none" aria-hidden>
                      <rect x="12" y="2" width="24" height="10" rx="2" fill="var(--green-soft)" stroke="var(--green)" strokeWidth="1.5" />
                      <rect x="8" y="12" width="32" height="50" rx="4" fill="#fff" stroke="var(--border)" strokeWidth="1.5" />
                      <rect x="13" y="26" width="22" height="24" rx="3" fill="var(--green-soft)" />
                    </svg>
                  )}
                </div>
                <div className={styles.body}>
                  <span className={`${styles.badge} ${styles[verdictClass(item.verdict)]}`}>
                    {item.verdict}
                  </span>
                  <h2 className={styles.name}>{item.productName}</h2>
                  <p className={styles.meta}>Scanned on {item.scannedOn}</p>
                  <p className={styles.score}>
                    {item.overallScore.toFixed(1)} <span className={styles.scoreMax}>/ 10</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function verdictClass(verdict: string): "good" | "fair" | "poor" {
  if (verdict === "Good Match") return "good";
  if (verdict === "Fair Match") return "fair";
  return "poor";
}
