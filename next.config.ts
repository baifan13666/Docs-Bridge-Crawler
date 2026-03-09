import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // External packages - prevent bundling native modules
  serverExternalPackages: ['sharp', 'onnxruntime-node', '@xenova/transformers'],
  
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
