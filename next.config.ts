import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sql.js unbundled so its WASM file is resolved at runtime by Node.js,
  // not inlined by Turbopack/webpack (which breaks WASM loading).
  serverExternalPackages: ["sql.js", "chromadb"],

  // Silence the turbopack/webpack conflict warning
  turbopack: {},

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY"    },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
