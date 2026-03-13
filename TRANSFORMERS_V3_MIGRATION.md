# Transformers.js v3 Migration - Vercel Deployment Fix

## Problem
The `libonnxruntime.so.1.14.0` error occurs because `onnxruntime-node` requires native C++ libraries that don't exist in Vercel's serverless environment.

## Solution Summary

### 1. Package Upgrade
Migrated from deprecated `@xenova/transformers` v2.17.2 to official `@huggingface/transformers` v3.8.1

### 2. Critical npm Overrides (The Key Fix)
Added to `package.json`:
```json
"overrides": {
  "onnxruntime-node": "npm:onnxruntime-web@^1.24.3"
}
```

This forces the library to use WASM-based `onnxruntime-web` instead of native `onnxruntime-node`.

Also added to `pnpm.overrides` for pnpm compatibility:
```json
"pnpm": {
  "overrides": {
    "sharp": "file:./sharp-stub",
    "onnxruntime-node": "npm:onnxruntime-web@^1.24.3"
  }
}
```

### 3. Next.js Configuration
Updated `next.config.ts`:
```typescript
serverExternalPackages: [
  '@huggingface/transformers',
  'onnxruntime-common',
  'onnxruntime-web',
  'onnxruntime-node'
],

webpack: (config, { isServer }) => {
  if (isServer) {
    config.externals = config.externals || [];
    config.externals.push({
      '@huggingface/transformers': 'commonjs @huggingface/transformers',
      'onnxruntime-common': 'commonjs onnxruntime-common',
      'onnxruntime-web': 'commonjs onnxruntime-web',
      'onnxruntime-node': 'commonjs onnxruntime-node',
    });
  }
  
  config.resolve.alias = {
    ...config.resolve.alias,
    'sharp$': false,
    'onnxruntime-node$': false,
    'onnxruntime-common$': false,
    'onnxruntime-web$': false,
  };
  
  return config;
}
```

### 4. Code Updates

#### Runtime Configuration
All API routes use Node.js runtime:
```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

#### WASM Backend Configuration
In `lib/embeddings/server-dual.ts` and `lib/embeddings/edge.ts`:
```typescript
import { pipeline, env } from '@huggingface/transformers';

// Force WASM backend to avoid native dependencies
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.simd = true;
}
```

#### API Changes (v2 → v3)
- Changed `quantized: true` to `dtype: 'q8'` in pipeline configuration
- Updated all imports from `@xenova/transformers` to `@huggingface/transformers`

## Why This Works

1. **npm overrides** prevent `onnxruntime-node` from being installed at all
2. **WASM backend** runs entirely in JavaScript/WebAssembly (portable, no native deps)
3. **Node.js runtime** provides better compatibility and performance than Edge runtime
4. **Webpack externals** prevent bundling issues
5. **Resolve aliases** ensure no accidental native module imports

## Key Insight
Webpack aliases alone aren't enough - you must prevent the native package from being installed using npm overrides. This is the critical piece that makes Vercel deployment work.

## Deployment Status

✅ All API routes configured with Node.js runtime
✅ WASM backend configured in both embedding modules
✅ npm overrides in place
✅ pnpm-lock.yaml updated with @huggingface/transformers v3.8.1

Ready for Vercel deployment!

## References
- [Hugging Face Transformers.js v3 Docs](https://huggingface.co/docs/transformers.js/v3.8.1/en/custom_usage)
- [ONNX Backend Configuration](https://huggingface.co/docs/transformers.js/api/backends/onnx)
