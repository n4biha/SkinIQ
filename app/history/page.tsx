import styles from "../placeholder.module.css";

export default function HistoryPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>History</h1>
      <p className={styles.subtext}>Your past product scans will appear here.</p>
      <div className={styles.stub}>No scans yet.</div>
    </div>
  );
}
