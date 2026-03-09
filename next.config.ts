import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack is now the default in Next.js 16
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Disable image optimization for crawler service
  images: {
    unoptimized: true,
  },
  // Opt-out native modules from bundling (sharp and @xenova/transformers are already in default list)
  serverExternalPackages: ['onnxruntime-node'],
};

export default nextConfig;
