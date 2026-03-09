import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Empty turbopack config to allow webpack config
  turbopack: {},
  
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // External packages (moved from experimental in Next.js 16)
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
  
  // Disable image optimization for crawler service
  images: {
    unoptimized: true,
  },
  
  // Webpack configuration to exclude native ONNX runtime
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Alias native modules to false to prevent bundling
      config.resolve.alias = {
        ...config.resolve.alias,
        'sharp$': false,
        'onnxruntime-node$': false,
      };
    }
    return config;
  },
};

export default nextConfig;
