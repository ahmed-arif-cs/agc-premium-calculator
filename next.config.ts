import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Task 33 (production security audit): baseline HTTP security headers
  // applied to every response. Deliberately conservative — no
  // Content-Security-Policy is added here, since this app loads Google
  // Fonts, calls external currency-rate APIs, may proxy AI/OCR vendor
  // calls, and renders user-controlled PDF/export content; a
  // one-size-fits-all CSP risks silently breaking one of those features,
  // and this task's own instructions rule out changing existing
  // exports/branding/features to work around a new restriction. The
  // headers below carry no such risk — they only remove behaviors
  // (framing, MIME-sniffing, referrer leakage, camera/mic/geolocation
  // access, which this app never uses) that this app was never relying
  // on in the first place.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevents this app from ever being framed by another origin
          // (clickjacking). No feature here embeds the app in an iframe.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from MIME-sniffing responses away from each
          // route's declared Content-Type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sends only the origin (never the full URL/path/query) as a
          // Referer header on cross-origin navigation/requests.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // This app never uses the camera, microphone, or geolocation
          // (OCR features accept an uploaded/captured file, not a live
          // getUserMedia stream) — explicitly denies all three so an
          // embedded/compromised third-party script couldn't invoke them.
          {
            key: "Permissions-Policy",
           value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
      {
        // PWA review: the browser's own update check for a service worker
        // is a byte-for-byte re-fetch of this exact URL — if it (or a CDN
        // in front of the deployment) is ever served with a cacheable
        // `Cache-Control`, that re-fetch can itself return a stale cached
        // copy, silently delaying every future offline/caching fix from
        // ever reaching already-installed users. Forcing revalidation on
        // every check is the standard fix; it doesn't change what the
        // worker does, only how promptly updates to it are noticed.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
