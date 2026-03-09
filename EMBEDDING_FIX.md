# Embedding 修复说明

## 问题
`@xenova/transformers` 默认尝试使用 native ONNX Runtime (`libonnxruntime.so`)，但 Vercel 不支持。

## 解决方案
1. **禁用 Turbopack**，使用 webpack 配置
2. **Webpack 排除 native modules** (`onnxruntime-node`, `sharp`)
3. **强制使用 WASM backend** 在 Node.js runtime 中

## 关键配置

### package.json
```json
{
  "scripts": {
    "build": "next build --webpack"
  }
}
```

### next.config.ts
```typescript
const nextConfig: NextConfig = {
  // 将 @xenova/transformers 标记为外部包
  serverExternalPackages: ['sharp', 'onnxruntime-node', '@xenova/transformers'],
  
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
env.cacheDir = '/tmp/.transformers-cache'; // Vercel 可写目录
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
git commit -m "Fix: Disable Turbopack and use webpack to exclude native ONNX"
git push
```

### 4. 验证
构建日志应该显示：
- ✅ 使用 webpack（不是 Turbopack）
- ✅ 没有 `[turbopack]_runtime.js` 错误

运行日志应该显示：
- ✅ `[Embeddings] Initializing e5-small model (384-dim) with WASM backend...`
- ✅ `[Embeddings] ✅ e5-small model ready (WASM)`
- ❌ 不应该看到 `libonnxruntime.so` 错误

## 架构

```
Worker (Node.js) → @xenova/transformers (WASM backend) ✅
```

## 模型

- **单模型策略**: e5-small-v2 (384-dim)
- **内存优化**: 使用相同的 embedding 填充 small 和 large 字段
- **原因**: Vercel 免费版 1GB 内存无法同时加载两个模型

注意：虽然数据库有 `embedding_small` 和 `embedding_large` 两个字段，但为了适应内存限制，两个字段存储相同的 384-dim embedding。

## 性能

- **Cold Start**: 5-10 秒（首次加载模型）
- **Warm Start**: < 1 秒
- **内存使用**: ~400MB（单模型）
- **处理方式**: 顺序处理以节省内存
- **完全免费**: 无需 API key

## 内存优化

Vercel 免费版限制 1GB 内存，优化措施：
1. **单模型**: 只使用 e5-small (384-dim)，不加载 e5-large
2. **使用 /tmp 缓存**: Vercel 唯一可写目录
3. **顺序处理**: 一次处理一个 chunk，不并行
4. **Singleton 模式**: 模型只加载一次，复用
5. **量化模型**: 使用 `quantized: true`

## 故障排除

### 如果还是看到 libonnxruntime.so 错误
1. 确认已删除 `turbopack: {}` 配置
2. 确认 webpack alias 配置正确
3. 删除 `.next` 和 `node_modules/.cache`
4. 清除 Vercel 构建缓存
5. 强制重新部署

### 如果还是看到 libonnxruntime.so 错误
1. 确认 build 脚本使用 `--no-turbopack` 标志
2. 确认 `serverExternalPackages` 包含 `@xenova/transformers`
3. 删除 `.next` 和 `node_modules/.cache`
4. 清除 Vercel 构建缓存
5. 强制重新部署

### 如果看到 Turbopack 相关错误
- 确认 `package.json` 中 build 脚本有 `--no-turbopack`
- 确认 `next.config.ts` 中没有 `turbopack: {}` 配置
- Vercel 会自动使用 package.json 中的 build 脚本

### 如果看到内存不足错误 (OOM)
- 当前已优化为单模型（e5-small 384-dim）
- 如果还是 OOM：
  1. 减少 chunk 大小或数量
  2. 升级 Vercel Pro（3GB 内存）
  3. 考虑使用外部 embedding API
- Next.js 16 默认使用 Turbopack
- 必须显式使用 `--no-turbopack` 来使用 webpack
- `serverExternalPackages` 告诉 Next.js 不要打包这些模块
