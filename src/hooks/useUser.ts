"use client";

import { useAuth } from "./useAuth";
import type { AuthUser } from "@/lib/auth/types";

export interface UseUserResult {
  user: AuthUser | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  guestId: string;
}

/**
 * Narrow, read-only slice of `useAuth()` for components that only need to
 * know "who is this" rather than the full session-management API
 * (`setSession`/`signOut`/`refreshSession`). Purely a convenience wrapper —
 * no additional state.
 */
export function useUser(): UseUserResult {
  const { user, isGuest, isAuthenticated, guestId } = useAuth();
  return { user, isGuest, isAuthenticated, guestId };
}
