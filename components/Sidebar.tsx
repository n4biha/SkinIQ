"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

/* Nav items only — no Premium / Upgrade / paywall anywhere. */
const NAV: NavItem[] = [
  {
    label: "Scan Product",
    href: "/scan",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
        <path
          d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/history",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
        <path
          d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M5 4v3.5h3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
        <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 19.5a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 3v2.2M12 18.8V21M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M3 12h2.2M18.8 12H21M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        <span className={styles.leaf} aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M20 4c0 8-5 13-13 13-1 0-2-.2-3-.5C5 9 11 4.5 20 4Z"
              fill="var(--green)"
            />
            <path
              d="M4 20c2-6 6-10 12-12"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className={styles.wordmark}>SkinIQ</span>
      </Link>

      <nav className={styles.nav}>
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
