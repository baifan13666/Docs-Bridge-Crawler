# 快速参考

## 🎯 核心变化

### Embedding 模型

| 用途 | 之前 | 现在 |
|------|------|------|
| 文档索引 | OpenAI (1536-dim) | bge-small-en (384-dim) + BGE-M3 (1024-dim) |
| 查询 | OpenAI (1536-dim) | bge-small-en (384-dim) **仅此一个** |

**重要**：
- ✅ Crawler 生成两个 embeddings（384-dim + 1024-dim）
- ✅ 查询**只使用** 384-dim，保证效率
- ✅ 1024-dim 为未来功能预留（高级搜索、重排等）

### 数据库字段

```sql
-- 之前
embedding vector(1536)

-- 现在
embedding_small vector(384)   -- 查询使用这个 ✅
embedding_large vector(1024)  -- 未来功能预留，查询时不用 ⏸️
```

## 🚀 Main App 最小改动（推荐）

### 1. 安装依赖
```bash
npm install @xenova/transformers
```

### 2. 创建 `lib/embeddings/query.ts`
```typescript
import { pipeline, env } from '@xenova/transformers';

env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.cacheDir = '/tmp/.transformers-cache';

const MODEL = 'Xenova/bge-small-en-v1.5';
let pipeline_instance: any = null;

async function initModel() {
  if (pipeline_instance) return pipeline_instance;
  pipeline_instance = await pipeline('feature-extraction', MODEL, {
    quantized: true,
  });
  return pipeline_instance;
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const model = await initModel();
  const output = await model(query, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data) as number[];
}
```

### 3. 更新搜索函数
```typescript
import { generateQueryEmbedding } from '@/lib/embeddings/query';

async function search(query: string) {
  const embedding = await generateQueryEmbedding(query);
  
  const { data } = await supabase.rpc('search_chunks_small', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 10
  });
  
  return data;
}
```

### 4. 创建 SQL 函数
```sql
CREATE OR REPLACE FUNCTION search_chunks_small(
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.embedding_small <=> query_embedding) as similarity
  FROM document_chunks dc
  WHERE dc.embedding_small IS NOT NULL
    AND 1 - (dc.embedding_small <=> query_embedding) > match_threshold
  ORDER BY dc.embedding_small <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 5. 更新 `next.config.ts`
```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', 'onnxruntime-node', '@xenova/transformers'],
  
  webpack: (config, { isServer }) => {
    if (isServer) {
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

## ✅ 完成！

就这么简单。5 个步骤，Main App 就能使用新的 embedding 系统。

## 📊 性能对比

| 指标 | 之前 | 现在 |
|------|------|------|
| 查询延迟 | ~200ms | ~100ms ⚡ |
| 成本 | $0.0001/query | $0 💰 |
| 内存 | 0 | ~300MB |
| 依赖 | OpenAI API | 本地模型 |

## 🔍 搜索质量

- **默认策略**: 只使用 384-dim (bge-small-en) ✅
- **搜索速度**: ~100ms，快速高效 ⚡
- **搜索质量**: 大多数场景足够好 👍
- **未来扩展**: 可以实现高级搜索使用 1024-dim 🚀

**为什么不默认使用 1024-dim？**
- 需要外部 API 调用（增加延迟）
- 依赖 HuggingFace Space 可用性
- 384-dim 在大多数场景下已经足够好
- 保持简单和高效

## 🐛 故障处理

### 如果搜索结果为空
1. 检查 `embedding_small` 是否为 null
2. 等待 Crawler Service 重新索引文档
3. 降低 `match_threshold`

### 如果内存不足
1. 确认 `next.config.ts` 配置正确
2. 检查是否使用 webpack（不是 Turbopack）
3. 查看 `EMBEDDING_FIX.md`

## 📚 更多信息

- `MAIN_APP_INTEGRATION.md` - 完整集成指南
- `EMBEDDING_ARCHITECTURE.md` - 架构说明
- `EMBEDDING_FIX.md` - 技术细节
