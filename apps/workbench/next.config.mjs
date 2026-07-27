// SPDX-License-Identifier: Apache-2.0

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3'],
  transpilePackages: [
    '@orqenix/memory-engine',
    '@orqenix/plugin-core',
    '@orqenix/settings-registry',
    '@orqenix/marketplace-core',
    '@orqenix/normalization-engine',
    '@orqenix/input-adapters',
    '@orqenix/output-adapters',
    '@orqenix/self-learning-observer',
    '@orqenix/self-learning-detection',
    '@orqenix/skill-genesis',
    '@orqenix/instinct-promoter',
    '@orqenix/verification-loop',
    '@orqenix/mcp-server',
    '@orqenix/local-memory-federation',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  env: { NEXT_TELEMETRY_DISABLED: '1' },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
