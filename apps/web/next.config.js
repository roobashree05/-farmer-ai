const path = require('path');
const { loadEnvConfig } = require('@next/env');

// Next loads env from apps/web before this file runs, and @next/env caches that empty result.
// forceReload reads the repository root .env that the API already uses.
loadEnvConfig(path.join(__dirname, '../..'), process.env.NODE_ENV !== 'production', console, true);

const publicEnv = {};
for (const key of [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_DEMO_MODE',
  'NEXT_PUBLIC_DEMO_EMAIL',
  'NEXT_PUBLIC_DEMO_PASSWORD',
]) {
  if (process.env[key]) publicEnv[key] = process.env[key];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: publicEnv,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@aijewel/ui', '@aijewel/types'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
