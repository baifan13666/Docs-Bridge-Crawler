import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // External packages - prevent bundling native modules
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-common',
    'onnxruntime-web',
    'onnxruntime-node'
  ],
  
  // Disable image optimization since we don't need it
  images: {
    unoptimized: true,
  },
  
  // Empty turbopack config to silence the warning
  turbopack: {},
  
  // Webpack configuration for WASM backend
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Mark as external to prevent bundling
      config.externals = config.externals || [];
      config.externals.push({
        '@huggingface/transformers': 'commonjs @huggingface/transformers',
        'onnxruntime-common': 'commonjs onnxruntime-common',
        'onnxruntime-web': 'commonjs onnxruntime-web',
        'onnxruntime-node': 'commonjs onnxruntime-node',
      });
    }
    
    // Alias native modules to false to prevent bundling
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
      'onnxruntime-common$': false,
      'onnxruntime-web$': false,
    };
    
    return config;
  },
};

export default nextConfig;