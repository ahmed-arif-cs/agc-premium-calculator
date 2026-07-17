"use client";

import { createContext } from "react";
import type { AuthContextValue } from "@/lib/auth/types";

/**
 * Auth context definition, kept separate from its provider implementation
 * (`src/components/auth/SessionProvider.tsx`) and from the consumer hook
 * (`src/hooks/useAuth.ts`) — three small, single-purpose files instead of
 * one that mixes context wiring with state-machine logic.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
