# Embedding 修复说明

## 问题
`@xenova/transformers` 默认尝试使用 native ONNX Runtime (`libonnxruntime.so`)，但 Vercel 不支持。

## 解决方案
1. **禁用 Turbopack**，使用 webpack 配置
2. **Webpack 排除 native modules** (`onnxruntime-node`, `sharp`)
3. **强制使用 WASM backend** 在 Node.js runtime 中

## 关键配置

### next.config.ts
```typescript
const nextConfig: NextConfig = {
  // 需要空的 turbopack 配置来允许 webpack 配置
  turbopack: {},
  
  // Next.js 16: serverComponentsExternalPackages 移到了 serverExternalPackages
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 排除 native modules
      config.resolve.alias = {
        ...config.resolve.alias,
        'sharp$': false,
        'onnxruntime-node$': false,
      };
    }
    return config;
  },
};
```

### lib/embeddings/server-dual.ts
```typescript
import { pipeline, env } from '@xenova/transformers';

// 在任何 pipeline 创建之前配置
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.allowLocalModels = false;
env.allowRemoteModels = true;
```

## 部署步骤

### 1. 删除本地构建缓存
```bash
rm -rf .next
rm -rf node_modules/.cache
```

### 2. 清除 Vercel 构建缓存
Vercel Dashboard → Settings → General → "Clear Build Cache"

### 3. 重新部署
```bash
git add .
git commit -m "Fix: Force WASM backend for transformers.js"
git push
```

### 4. 验证
日志应该显示：
- ✅ `[Embeddings] Initializing e5-small model (384-dim) with WASM backend...`
- ✅ `[Embeddings] ✅ e5-small model ready (WASM)`
- ✅ `[Embeddings] ✅ e5-large model ready (WASM)`
- ❌ 不应该看到 `libonnxruntime.so` 错误

## 架构

```
Worker (Node.js) → @xenova/transformers (WASM backend) ✅
```

## 模型

- **Small**: e5-small-v2 (384-dim)
- **Large**: e5-large-v2 (1024-dim)

## 性能

- **Cold Start**: 10-20 秒（首次加载模型）
- **Warm Start**: < 1 秒
- **完全免费**: 无需 API key

## 故障排除

### 如果还是看到 libonnxruntime.so 错误
1. 确认已删除 `turbopack: {}` 配置
2. 确认 webpack alias 配置正确
3. 删除 `.next` 和 `node_modules/.cache`
4. 清除 Vercel 构建缓存
5. 强制重新部署

### 如果看到 "Failed to load external module"
- 这说明 webpack 配置没有生效
- 确认 `next.config.ts` 中有 `turbopack: {}` 配置（允许 webpack 配置共存）
- 确认 `serverExternalPackages` 包含 `onnxruntime-node` 和 `sharp`

### Next.js 16 注意事项
- Next.js 16 默认使用 Turbopack
- 如果有 webpack 配置，必须同时有 `turbopack: {}` 配置
- `serverComponentsExternalPackages` 已移到 `serverExternalPackages`
