"use client";

import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import type { AuthContextValue } from "@/lib/auth/types";

/**
 * Access the current auth/session state.
 *
 * Must be called from within `<SessionProvider>` (mounted once in
 * `src/app/layout.tsx`). Safe to use from any client component today even
 * though no login UI exists yet — `status` simply reads `"guest"` (or
 * briefly `"initializing"` on first mount) until real accounts ship.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used within <SessionProvider>");
  }
  return ctx;
}
