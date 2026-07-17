"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Rendered instead of `children` while signed out. Defaults to `null`. */
  fallback?: ReactNode;
  /**
   * Rendered instead of `children`/`fallback` while the initial session
   * check is still in flight (`status === "initializing"`). Defaults to `null`.
   */
  loadingFallback?: ReactNode;
}

/**
 * Client-side gate for account-only *sections* of a page, as opposed to
 * whole routes (which `src/middleware.ts` handles at the edge).
 *
 * No feature in the app requires an account today — this is foundation
 * for the first account-gated feature (e.g. "sync history to your
 * account") to drop into later without inventing its own auth-check
 * boilerplate. Nothing currently renders inside one.
 *
 * Usage (future):
 * ```tsx
 * <ProtectedRoute fallback={<SignInPrompt />}>
 *   <CloudSyncPanel />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  fallback = null,
  loadingFallback = null,
}: ProtectedRouteProps) {
  const { status } = useAuth();

  if (status === "initializing") return <>{loadingFallback}</>;
  if (status !== "authenticated") return <>{fallback}</>;
  return <>{children}</>;
}
