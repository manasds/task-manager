import type { NextConfig } from 'next';

/** Sent on every response. Vercel adds Strict-Transport-Security itself. */
const SECURITY_HEADERS = [
  // No other site may show Tasky in a frame, so it can't be dressed up to trick clicks.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites see only the origin, never a path such as /share?url=…
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'pg-connection-string'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
