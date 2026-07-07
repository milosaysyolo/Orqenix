// SPDX-License-Identifier: Apache-2.0

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for distributable bundles
  output: "standalone",

  // Workbench is local-first; no external CDN required
  poweredByHeader: false,
  reactStrictMode: true,

  // Workbench runs at port 27420 by default
  // Hostname binding to 127.0.0.1 is enforced at script level

  // Disable SWC minification temporarily for faster dev
  swcMinify: true,

  experimental: {
    // Enable React 19 features
    reactCompiler: false,
  },

  // Headers for security (defense in depth)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:27420; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },

  // Production assets URL prefix
  // Set ORQENIX_WORKBENCH_BASE_URL=/orqenix if behind reverse proxy
  basePath: process.env.ORQENIX_WORKBENCH_BASE_URL || "",
};

export default nextConfig;
