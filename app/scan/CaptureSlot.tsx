"use client";

/**
 * One capture slot (front OR back). Encapsulates the upload/camera toggle, the
 * dropzone, the CameraCapture component, the preview, and retake/replace — all
 * driven by props so the page can render two independent slots without
 * duplicating any capture code.
 *
 * Camera hygiene: this slot only mounts <CameraCapture> (which owns the live
 * stream) when `cameraActive` is true. The page guarantees only ONE slot is
 * active at a time, so there's never more than one stream / camera light on.
 */

import { useRef, useState } from "react";
import CameraCapture from "./CameraCapture";
import styles from "./scan.module.css";

export type Method = "upload" | "camera";

type Props = {
  title: string;
  method: Method;
  preview: string | null;
  /** Whether THIS slot currently owns the single live camera. */
  cameraActive: boolean;
  onMethod: (m: Method) => void;
  onFile: (f?: File | null) => void;
  onReset: () => void;
};

export default function CaptureSlot({
  title,
  method,
  preview,
  cameraActive,
  onMethod,
  onFile,
  onReset,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className={styles.slot}>
      <p className={styles.slotTitle}>{title}</p>

      <div className={styles.methodToggle} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={method === "upload"}
          className={`${styles.methodBtn} ${method === "upload" ? styles.methodActive : ""}`}
          onClick={() => onMethod("upload")}
        >
          Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === "camera"}
          className={`${styles.methodBtn} ${method === "camera" ? styles.methodActive : ""}`}
          onClick={() => onMethod("camera")}
        >
          Camera
        </button>
      </div>

      {preview ? (
        <div className={styles.previewWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={title} className={styles.preview} />
        </div>
      ) : method === "upload" ? (
        <div
          className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <span className={styles.dropIcon}>
            <ImageIcon />
          </span>
          <p className={styles.dropTitle}>Upload photo</p>
          <p className={styles.dropHint}>or drag and drop</p>
          <p className={styles.dropMeta}>JPG, PNG up to 10MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      ) : cameraActive ? (
        // Reuses the same CameraCapture as before — captured frame → onFile.
        <CameraCapture onCapture={onFile} />
      ) : (
        // Camera method, but the other slot currently owns the single stream.
        <div className={styles.camera}>
          <p className={styles.cameraNote}>Camera is in use by the other photo.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onMethod("camera")}
          >
            Use camera here
          </button>
        </div>
      )}

      {preview && (
        <div className={styles.slotActions}>
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            {method === "camera" ? "Retake" : "Replace"}
          </button>
        </div>
      )}
    </div>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="9.5" r="1.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 17 4.5-4.5 4 4 3-3L20 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
