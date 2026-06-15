"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SkinProfileSchema, type SkinProfile, type SkinType } from "@/lib/types";
import { createBrowserSupabase } from "@/lib/supabase-browser";

const STORAGE_KEY = "skiniq:profile";

/** Whether a Supabase project is wired up (public env present). When false the
 *  profile lives only in localStorage and we never touch the network. */
const SUPABASE_ENABLED =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const EMPTY_PROFILE: SkinProfile = {
  skinType: null,
  sensitive: false,
  concerns: [],
  allergies: [],
};

function isEmptyProfile(p: SkinProfile): boolean {
  return (
    !p.skinType &&
    !p.sensitive &&
    p.concerns.length === 0 &&
    p.allergies.length === 0
  );
}

/** Read + validate the profile saved in localStorage (null if absent/invalid). */
function readLocal(): SkinProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = SkinProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** GET the signed-in user's saved profile, or null (guest / unconfigured / error). */
async function fetchRemote(): Promise<SkinProfile | null> {
  if (!SUPABASE_ENABLED) return null;
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.profile) return null;
    const parsed = SkinProfileSchema.safeParse(json.profile);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** PUT the profile to the account (no-ops for guests / when unconfigured). */
async function pushRemote(profile: SkinProfile): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  try {
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
  } catch {
    // best-effort — localStorage still holds the profile
  }
}

type ProfileContextValue = {
  profile: SkinProfile;
  /** False until the initial load (localStorage + account) completes; lets pages avoid a flash. */
  hydrated: boolean;
  setSkinType: (type: SkinType) => void;
  setSensitive: (value: boolean) => void;
  toggleConcern: (concern: string) => void;
  addAllergy: (term: string) => void;
  removeAllergy: (term: string) => void;
  setProfile: (profile: SkinProfile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<SkinProfile>(EMPTY_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  // Mirrors the latest profile for use inside non-reactive callbacks (auth events).
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // When we load a profile (from storage/DB or an auth event) we don't want that
  // assignment to immediately bounce back to the server. This skips one save.
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load: localStorage first (instant), then the account's saved profile
  // if signed in. State is set in the async callback, so the effect body has no
  // synchronous setState.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = readLocal();
      const remote = await fetchRemote();
      if (cancelled) return;

      if (remote) {
        skipNextSave.current = true;
        setProfileState(remote);
      } else if (local) {
        skipNextSave.current = true;
        setProfileState(local);
        // Signed-in user with a local-only profile and nothing saved yet:
        // push it up so a guest-built profile isn't lost on first sign-in.
        if (!isEmptyProfile(local)) void pushRemote(local);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on change (after the initial load): localStorage immediately, the
  // account (when signed in) debounced so rapid edits don't spam the API.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore storage write failures (e.g. private mode)
    }

    if (!SUPABASE_ENABLED) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const snapshot = profile;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void pushRemote(snapshot), 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [profile, hydrated]);

  // Re-sync with the account when the user signs in (e.g. after the magic link).
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const supabase = createBrowserSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      void (async () => {
        const remote = await fetchRemote();
        if (remote) {
          skipNextSave.current = true;
          setProfileState(remote);
        } else if (!isEmptyProfile(profileRef.current)) {
          // No saved profile yet — adopt the one already on this device.
          void pushRemote(profileRef.current);
        }
      })();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: ProfileContextValue = {
    profile,
    hydrated,
    setSkinType: (type) => setProfileState((p) => ({ ...p, skinType: type })),
    setSensitive: (value) => setProfileState((p) => ({ ...p, sensitive: value })),
    toggleConcern: (concern) =>
      setProfileState((p) => ({
        ...p,
        concerns: p.concerns.includes(concern)
          ? p.concerns.filter((c) => c !== concern)
          : [...p.concerns, concern],
      })),
    addAllergy: (term) =>
      setProfileState((p) => {
        const t = term.trim();
        if (!t || p.allergies.some((a) => a.toLowerCase() === t.toLowerCase())) {
          return p;
        }
        return { ...p, allergies: [...p.allergies, t] };
      }),
    removeAllergy: (term) =>
      setProfileState((p) => ({
        ...p,
        allergies: p.allergies.filter((a) => a !== term),
      })),
    setProfile: (next) => setProfileState(next),
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
