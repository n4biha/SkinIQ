"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/Stepper";
import { useProfile } from "@/lib/profile-context";
import CaptureSlot, { type Method } from "./CaptureSlot";
import styles from "./scan.module.css";

type View = "upload" | "analyzing";

// The two independent capture slots.
type Slot = "front" | "back";

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
  const [error, setError] = useState<string | null>(null);
  // Set when the API says the BACK photo isn't an ingredient list — a calm,
  // expected outcome (not an error), holding the reason to show.
  const [rejected, setRejected] = useState<string | null>(null);

  // Two independent slots. Back (ingredients) is required; front is optional.
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backMethod, setBackMethod] = useState<Method>("upload");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontMethod, setFrontMethod] = useState<Method>("upload");
  // At most ONE live camera at a time, shared between the slots.
  const [activeCameraSlot, setActiveCameraSlot] = useState<Slot | null>(null);

  // Scanning is step 2 — it needs a skin profile. If someone lands here without
  // one (e.g. via the sidebar before onboarding), send them to step 1 first.
  const needsOnboarding = hydrated && !profile.skinType;
  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  function handleFile(slot: Slot, f?: File | null) {
    if (!f || !f.type.startsWith("image/")) return;
    const url = URL.createObjectURL(f);
    if (slot === "back") {
      setBackFile(f);
      setBackPreview(url);
    } else {
      setFrontFile(f);
      setFrontPreview(url);
    }
    setError(null);
    setRejected(null);
    if (activeCameraSlot === slot) setActiveCameraSlot(null); // captured → stream done
  }

  function resetSlot(slot: Slot) {
    if (slot === "back") {
      setBackFile(null);
      setBackPreview(null);
    } else {
      setFrontFile(null);
      setFrontPreview(null);
    }
    setError(null);
    setRejected(null);
    if (activeCameraSlot === slot) setActiveCameraSlot(null);
  }

  /** Switch a slot's input method; starts that slot fresh. Choosing camera claims
   *  the single live stream (so the other slot's CameraCapture unmounts → light off). */
  function setSlotMethod(slot: Slot, m: Method) {
    if (slot === "back") setBackMethod(m);
    else setFrontMethod(m);
    resetSlot(slot);
    if (m === "camera") setActiveCameraSlot(slot);
  }

  async function onAnalyze() {
    if (!backFile) return; // back is required
    setView("analyzing");
    setError(null);
    try {
      const body: Record<string, unknown> = {
        backImage: await fileToBase64(backFile),
        backMimeType: backFile.type,
        profile,
      };
      // Front is optional + best-effort; the API ignores/soft-rejects bad fronts.
      if (frontFile) {
        body.frontImage = await fileToBase64(frontFile);
        body.frontMimeType = frontFile.type;
      }
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      // Back isn't an ingredient list — expected, not a failure. Calm retry prompt.
      if (res.status === 422) {
        const data = await res.json().catch(() => null);
        setBackFile(null);
        setBackPreview(null);
        setRejected(
          data?.reason ?? "We couldn't find an ingredient list in this photo.",
        );
        setView("upload");
        return;
      }
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

      <h1 className={styles.heading}>Scan your product</h1>
      <p className={styles.subtext}>
        Add a clear photo of the ingredient list (required). A photo of the
        product front is optional — we use it for the name and thumbnail.
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {rejected && (
        <div className={styles.rejected}>
          <p className={styles.rejectedTitle}>We couldn&apos;t read an ingredient list</p>
          <p className={styles.rejectedReason}>{rejected}</p>
          <p className={styles.rejectedHint}>
            Make sure the ingredient-list photo shows the list on the back or side
            of the packaging — see the photo tips on the right.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setRejected(null)}
          >
            Try another photo
          </button>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.slots}>
          <CaptureSlot
            title="Front of product (optional)"
            method={frontMethod}
            preview={frontPreview}
            cameraActive={activeCameraSlot === "front"}
            onMethod={(m) => setSlotMethod("front", m)}
            onFile={(f) => handleFile("front", f)}
            onReset={() => resetSlot("front")}
          />

          <CaptureSlot
            title="Ingredient list (required)"
            method={backMethod}
            preview={backPreview}
            cameraActive={activeCameraSlot === "back"}
            onMethod={(m) => setSlotMethod("back", m)}
            onFile={(f) => handleFile("back", f)}
            onReset={() => resetSlot("back")}
          />

          <div className={styles.uploadActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAnalyze}
              disabled={!backFile}
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
