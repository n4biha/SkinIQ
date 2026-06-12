import styles from "../placeholder.module.css";

export default function ProfilePage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Profile</h1>
      <p className={styles.subtext}>View and edit your saved skin profile.</p>
      <div className={styles.stub}>Profile view coming in the next slice.</div>
    </div>
  );
}
