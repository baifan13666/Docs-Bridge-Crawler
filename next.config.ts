import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Disable image optimization for crawler service
  images: {
    unoptimized: true,
  },
  // Webpack configuration for native modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude native bindings from webpack bundling
      config.externals = config.externals || [];
      config.externals.push({
        'sharp': 'commonjs sharp',
        'onnxruntime-node': 'commonjs onnxruntime-node',
        '@xenova/transformers': 'commonjs @xenova/transformers',
      });
      
      // Ignore .node files
      config.module = config.module || {};
      config.module.rules = config.module.rules || [];
      config.module.rules.push({
        test: /\.node$/,
        use: 'node-loader',
      });
    }
    
    return config;
  },
};

export default nextConfig;
