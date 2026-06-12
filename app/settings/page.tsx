import styles from "../placeholder.module.css";

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>
      <p className={styles.subtext}>App preferences will live here.</p>
      <div className={styles.stub}>Nothing to configure yet.</div>
    </div>
  );
}
