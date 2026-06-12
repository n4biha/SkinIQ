"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SkinProfileSchema, type SkinProfile, type SkinType } from "@/lib/types";

const STORAGE_KEY = "skiniq:profile";

const EMPTY_PROFILE: SkinProfile = {
  skinType: null,
  concerns: [],
  allergies: [],
};

type ProfileContextValue = {
  profile: SkinProfile;
  /** False until we've read localStorage on the client; lets pages avoid a flash. */
  hydrated: boolean;
  setSkinType: (type: SkinType) => void;
  toggleConcern: (concern: string) => void;
  setProfile: (profile: SkinProfile) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<SkinProfile>(EMPTY_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  // Load any saved profile once, on the client.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = SkinProfileSchema.safeParse(JSON.parse(raw));
        if (parsed.success) setProfileState(parsed.data);
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  // Persist on every change (after the initial load).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore storage write failures (e.g. private mode)
    }
  }, [profile, hydrated]);

  const value: ProfileContextValue = {
    profile,
    hydrated,
    setSkinType: (type) => setProfileState((p) => ({ ...p, skinType: type })),
    toggleConcern: (concern) =>
      setProfileState((p) => ({
        ...p,
        concerns: p.concerns.includes(concern)
          ? p.concerns.filter((c) => c !== concern)
          : [...p.concerns, concern],
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
