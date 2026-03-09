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
  // Opt-out native modules from bundling
  serverExternalPackages: ['onnxruntime-node'],
  
  // Force @xenova/transformers to use WASM backend
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude native ONNX runtime
      config.externals = config.externals || [];
      config.externals.push({
        'onnxruntime-node': 'commonjs onnxruntime-node',
        'sharp': 'commonjs sharp',
      });
      
      // Alias to prevent loading native modules
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };
    }
    return config;
  },
};

export default nextConfig;
