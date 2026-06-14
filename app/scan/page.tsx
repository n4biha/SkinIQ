"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/Stepper";
import { useProfile } from "@/lib/profile-context";
import styles from "./scan.module.css";

type View = "upload" | "analyzing";

const ANALYZE_STEPS = [
  "Reading ingredient list",
  "Understanding ingredients",
  "Matching to your skin profile",
  "Building your report",
];

const TIPS = [
  "Well-lit photo",
  "Focus on ingredient list",
  "Avoid glare and shadows",
  "Hold camera steady",
];

export default function ScanPage() {
  const router = useRouter();
  const { profile, hydrated } = useProfile();
  const [view, setView] = useState<View>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scanning is step 2 — it needs a skin profile. If someone lands here without
  // one (e.g. via the sidebar before onboarding), send them to step 1 first.
  const needsOnboarding = hydrated && !profile.skinType;
  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  function handleFile(f?: File | null) {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function onAnalyze() {
    if (!file) return;
    setView("analyzing");
    setError(null);
    try {
      const image = await fileToBase64(file);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, mimeType: file.type, profile }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Analysis failed (${res.status}).`);
      }
      const { id } = await res.json();
      router.push(`/report/${id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setView("upload");
    }
  }

  // Wait for the profile to load (avoids a flash) and hold while redirecting.
  if (!hydrated || needsOnboarding) {
    return null;
  }

  if (view === "analyzing") {
    return <Analyzing />;
  }

  return (
    <div className={styles.page}>
      <Stepper current={2} />

      <h1 className={styles.heading}>Scan the ingredient list</h1>
      <p className={styles.subtext}>
        Take a clear photo of the product packaging — we read the ingredients
        straight off the label.
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.grid}>
        {/* Upload zone */}
        <div>
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected label" className={styles.preview} />
            ) : (
              <>
                <span className={styles.dropIcon}>
                  <ImageIcon />
                </span>
                <p className={styles.dropTitle}>Upload photo</p>
                <p className={styles.dropHint}>or drag and drop</p>
                <p className={styles.dropMeta}>JPG, PNG up to 10MB</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          <div className={styles.uploadActions}>
            {preview && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
              >
                Choose another
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAnalyze}
              disabled={!preview}
            >
              Analyze product →
            </button>
          </div>
        </div>

        {/* Example card */}
        <aside className={`card ${styles.example}`}>
          <p className={styles.exampleLabel}>Example</p>
          <div className={styles.sampleLabel} aria-hidden>
            <div className={styles.sampleTitle}>Ingredients</div>
            {[88, 70, 94, 60, 80].map((w, i) => (
              <div
                key={i}
                className={styles.sampleLine}
                style={{ width: `${w}%` }}
              />
            ))}
          </div>

          <p className={styles.tipsHeading}>Good photo tips</p>
          <ul className={styles.tips}>
            {TIPS.map((tip) => (
              <li key={tip} className={styles.tip}>
                <span className={styles.tipCheck}>
                  <CheckIcon />
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/* ---- Helpers ---- */

/** Read a File into a bare base64 string (no `data:...;base64,` prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

/* ---- Analyzing state (Stepper step 3) ---- */

// Purely visual: animate through the steps while the real /api/analyze request
// is in flight, then hold on the last step until the page navigates to the report.
function Analyzing() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= ANALYZE_STEPS.length - 1) return; // hold on the final step
    const t = setTimeout(() => setActive((a) => a + 1), 1800);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className={styles.page}>
      <Stepper current={3} />
      <div className={styles.analyzingWrap}>
        <h1 className={styles.heading}>Analyzing your product…</h1>
        <p className={styles.subtext}>This usually takes 10–20 seconds.</p>

        <ul className={styles.checklist}>
          {ANALYZE_STEPS.map((label, i) => {
            const state =
              i < active ? "done" : i === active ? "current" : "pending";
            return (
              <li key={label} className={`${styles.checkRow} ${styles[state]}`}>
                <span className={styles.checkMark}>
                  {state === "done" ? (
                    <CheckIcon />
                  ) : state === "current" ? (
                    <span className={styles.spinner} />
                  ) : (
                    <span className={styles.dot} />
                  )}
                </span>
                {label}
              </li>
            );
          })}
        </ul>

        <div className={styles.privacy}>
          <LockIcon />
          Your data is private and secure.
        </div>
      </div>
    </div>
  );
}

/* ---- Icons ---- */

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="9.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 17 4.5-4.5 4 4 3-3L20 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
