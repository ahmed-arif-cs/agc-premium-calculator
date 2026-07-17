/**
 * Route-protection registry.
 *
 * The app is a single public route (`/`) today, and every calculator
 * feature (standard/scientific/converter, memory, history, settings,
 * all six export formats) works fully signed-out. This is the one place
 * a future account-only route (e.g. `/account`, `/sync`) gets registered,
 * so both `src/proxy.ts` (edge-level redirect for whole routes) and
 * `<ProtectedRoute>` (client-level gate for a section of a page) read
 * from the same source instead of duplicating a route list.
 */
export const PROTECTED_ROUTE_PREFIXES: readonly string[] = [
  // "/account",
  // "/sync",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
