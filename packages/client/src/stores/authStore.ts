import { create } from "zustand";
import type { User } from "firebase/auth";
import {
  getUserIdToken,
  observeAuthState,
  signInWithGoogle,
  signInWithX,
  signOutFirebase,
} from "@/lib/firebase/auth";
import { loginWithIdToken, type AuthUserDto } from "@/lib/api";

export type AuthStatus = "loading" | "guest" | "authenticated";

export interface AuthStore {
  status: AuthStatus;
  profile: AuthUserDto | null;
  error: string | null;
  initialize: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithX: () => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
}

let initialized = false;
let unsubscribeAuthState: (() => void) | undefined;

async function syncWithBackend(user: User): Promise<AuthUserDto> {
  const idToken = await getUserIdToken(user);
  return loginWithIdToken(idToken);
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: "loading",
  profile: null,
  error: null,

  initialize: () => {
    if (initialized) return;
    initialized = true;

    unsubscribeAuthState?.();
    unsubscribeAuthState = observeAuthState(async (user) => {
      if (!user) {
        set({ status: "guest", profile: null, error: null });
        return;
      }

      set({ status: "loading", error: null });
      try {
        const profile = await syncWithBackend(user);
        set({ status: "authenticated", profile, error: null });
      } catch (error) {
        set({
          status: "guest",
          profile: null,
          error: error instanceof Error ? error.message : "ログインに失敗しました",
        });
      }
    });
  },

  loginWithGoogle: async () => {
    set({ status: "loading", error: null });
    try {
      const user = await signInWithGoogle();
      const profile = await syncWithBackend(user);
      set({ status: "authenticated", profile, error: null });
    } catch (error) {
      set({
        status: "guest",
        profile: null,
        error: error instanceof Error ? error.message : "Googleログインに失敗しました",
      });
    }
  },

  loginWithX: async () => {
    set({ status: "loading", error: null });
    try {
      const user = await signInWithX();
      const profile = await syncWithBackend(user);
      set({ status: "authenticated", profile, error: null });
    } catch (error) {
      set({
        status: "guest",
        profile: null,
        error: error instanceof Error ? error.message : "Xログインに失敗しました",
      });
    }
  },

  continueAsGuest: () => {
    set({ status: "guest", profile: null, error: null });
  },

  logout: async () => {
    try {
      await signOutFirebase();
    } finally {
      set({ status: "guest", profile: null, error: null });
    }
  },
}));
