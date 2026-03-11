import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // External packages - prevent bundling native modules
  serverExternalPackages: ['onnxruntime-node', '@xenova/transformers'],
  
  // Disable image optimization since we don't need it
  images: {
    unoptimized: true,
  },
  
  // Empty turbopack config to silence the warning
  turbopack: {},
  
  // Webpack configuration to exclude native ONNX runtime (fallback)
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Alias native modules to false to prevent bundling
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };
    }
    return config;
  },
};

export default nextConfig;