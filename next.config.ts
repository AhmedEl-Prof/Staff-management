import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Strict mode helps surface bugs early in development.
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Block the app from being embedded in iframes (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Don't let browsers MIME-sniff responses.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send only the origin cross-site; full URL stays first-party.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app doesn't use these sensors/APIs.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
