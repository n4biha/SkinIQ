"use client";

/**
 * Camera capture for the scan page.
 *
 * This is an ADDITIONAL way to get a photo into the scan flow — it does NOT touch
 * the analyze pipeline. When the user captures a frame we hand a plain `File`
 * (image/jpeg) to `onCapture`, which is the same `handleFile` the upload zone
 * uses. From that point on, the upload and camera paths are identical.
 *
 * Layered approach:
 *  - Desktop / modern mobile: a live <video> preview via getUserMedia, with a
 *    Capture button that grabs the current frame to a <canvas> → JPEG File.
 *  - If getUserMedia is missing or the user blocks permission: fall back to a
 *    file input with capture="environment" (opens the device camera app), so the
 *    user is never stuck.
 *
 * IMPORTANT: a live camera stream keeps the camera light on. We stop every track
 * after capture and in the effect cleanup (covers retake / switching to upload /
 * leaving the page).
 */

import { useEffect, useRef, useState } from "react";
import styles from "./scan.module.css";

type Props = {
  /** Called once we have an image, exactly like the upload zone's handleFile. */
  onCapture: (file: File) => void;
};

// Where we are in the camera lifecycle.
type CamState = "starting" | "live" | "denied" | "unsupported";

export default function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Hold the active stream in a ref (not state) so cleanup can always reach it.
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CamState>("starting");

  /** Stop the camera so the hardware light turns off. Safe to call repeatedly. */
  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Start the camera as soon as this component mounts. It only mounts when the
  // user taps "Take photo", so permission is requested exactly then — never on
  // page load.
  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Feature-detect: older/insecure contexts may not expose getUserMedia.
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }
      try {
        // facingMode "environment" prefers the rear camera on phones; on desktop
        // it's just a hint, so the default webcam is used.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          // Component unmounted while we were waiting — don't leak the stream.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setState("live");
      } catch {
        // Permission denied, no camera, or in use elsewhere.
        if (!cancelled) setState("denied");
      }
    }

    start();

    // Cleanup: stop the camera on unmount (retake remounts us, switching method
    // or leaving the page unmounts us).
    return () => {
      cancelled = true;
      stopStream();
    };
  }, []);

  /** Grab the current video frame, turn it into a JPEG File, hand it up. */
  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        stopStream(); // we have the photo — turn the camera off immediately
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  }

  // Fallback path: a normal file input that opens the device camera app. Used
  // when getUserMedia is unavailable or the user blocked the live camera.
  if (state === "unsupported" || state === "denied") {
    return (
      <div className={styles.camera}>
        <p className={styles.cameraNote}>
          {state === "denied"
            ? "Camera access blocked — capture with your device camera, or switch to Upload photo."
            : "Live camera isn't available here — capture with your device camera, or switch to Upload photo."}
        </p>
        <label className={`btn btn-secondary ${styles.cameraFallback}`}>
          Take photo with camera
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCapture(f);
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className={styles.camera}>
      {/* muted + playsInline are required for autoplay, especially on iOS. */}
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        playsInline
        muted
      />
      {state === "starting" && (
        <p className={styles.cameraStatus}>Starting camera…</p>
      )}
      <div className={styles.cameraActions}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={capture}
          disabled={state !== "live"}
        >
          Capture photo
        </button>
      </div>
    </div>
  );
}
