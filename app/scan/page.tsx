"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/Stepper";
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
  const [view, setView] = useState<View>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file?: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function onAnalyze() {
    // Phase A: simulate the pipeline, then route to a mock report.
    // Phase B replaces this with a POST to /api/analyze.
    setView("analyzing");
  }

  if (view === "analyzing") {
    return <Analyzing onDone={() => router.push("/report/sample")} />;
  }

  return (
    <div className={styles.page}>
      <Stepper current={2} />

      <h1 className={styles.heading}>Scan the ingredient list</h1>
      <p className={styles.subtext}>
        Take a clear photo of the product packaging — we read the ingredients
        straight off the label.
      </p>

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
                onClick={() => setPreview(null)}
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

/* ---- Analyzing state (Stepper step 3) ---- */

function Analyzing({ onDone }: { onDone: () => void }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= ANALYZE_STEPS.length) {
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setActive((a) => a + 1), 1400);
    return () => clearTimeout(t);
  }, [active, onDone]);

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
