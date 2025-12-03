import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019a0ffe-3479-9fde-e225-061b225acf64',
        permanent: false, // 307 temporary redirect
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Fix for viem and other ESM packages
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // Handle viem bundling issues
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    return config;
  },
  // Disable static optimization for dynamic routes with blockchain data
  experimental: {
    optimizePackageImports: ['viem', '@coinbase/agentkit'],
  },
};

export default nextConfig;
