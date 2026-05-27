import path from "node:path";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Strict-ish CSP for an admin panel that doesn't render third-party content.
// 'unsafe-inline' for styles is required by Radix/shadcn primitives.
// 'unsafe-inline' for scripts is required by Next App Router streaming —
// the RSC payload is injected as `<script>self.__next_f.push(...)`.
// Backlog: migrate to nonce-based CSP (proxy.ts generates nonce → headers).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Pin Turbopack root — repo has both root + frontend/admin lockfiles
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Standalone bundle must trace only this app (avoid copying the whole monorepo)
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
