import type { NextConfig } from "next";

let storageOrigin = "";
try {
  if (process.env.AWS_ENDPOINT_URL_S3) storageOrigin = new URL(process.env.AWS_ENDPOINT_URL_S3).origin;
} catch {}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // YouTube is only contacted after a visitor presses "Load YouTube video".
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  // Direct photo uploads go to Neon Object Storage via short-lived signed URLs.
  `connect-src 'self' https://*.neon.tech ${storageOrigin}`.trim(),
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "heic-convert", "libheif-js"],
  // The birthday invite photo is read from disk by its route; ship it with that function.
  outputFileTracingIncludes: { "/sweet16/photo": ["./assets/celebrate/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
