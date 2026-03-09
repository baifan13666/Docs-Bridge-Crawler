import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable Turbopack to use webpack configuration
  // turbopack: {}, // REMOVED
  
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Exclude native packages from server bundle
    serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
  },
  
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
