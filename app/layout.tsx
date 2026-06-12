import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import styles from "./layout.module.css";
import Sidebar from "@/components/Sidebar";
import { ProfileProvider } from "@/lib/profile-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SkinIQ",
  description: "Personalized skincare ingredient analysis for your skin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ProfileProvider>
          <div className={styles.shell}>
            <Sidebar />
            <main className={styles.main}>{children}</main>
          </div>
        </ProfileProvider>
      </body>
    </html>
  );
}
