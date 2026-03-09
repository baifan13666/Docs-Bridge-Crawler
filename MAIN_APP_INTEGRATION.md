# Main App 集成指南

## 概述

Crawler Service 现在使用新的 embedding 架构，Main App 需要相应调整搜索逻辑。

## 数据库 Schema 变化

### document_chunks 表

```sql
-- 现在
embedding_small vector(384)   -- bge-small-en-v1.5 (本地生成，立即可用)
embedding_large vector(1024)  -- BGE-M3-Distill-8L (异步生成，为未来功能预留)
```

**重要说明**：
- ✅ Crawler 会生成并保存**两个** embeddings
- ✅ `embedding_small` (384-dim) - 立即生成，用于查询
- ✅ `embedding_large` (1024-dim) - 异步生成，为未来功能预留
- ⚠️ 查询时**默认只使用** `embedding_small`，保证效率
- ⚠️ `embedding_large` 可能为 null（正在异步生成中）
- 💡 未来可以实现高级搜索功能使用 `embedding_large`

## Embedding 模型变化

### Crawler Service (文档索引)

| 阶段 | 模型 | 维度 | 生成方式 |
|------|------|------|----------|
| Phase 1 | bge-small-en-v1.5 | 384 | 本地 WASM (同步) |
| Phase 2 | BGE-M3-Distill-8L | 1024 | 外部 API (异步) |

### Main App (查询)

**默认策略（推荐）**：只使用 384-dim，保证效率

| 用途 | 模型 | 维度 | 说明 |
|------|------|------|------|
| 查询 | bge-small-en-v1.5 | 384 | 默认使用，快速高效 |

**未来可选策略**：两阶段搜索（目前不推荐）

| 用途 | 模型 | 维度 | 说明 |
|------|------|------|------|
| 粗筛 | bge-small-en-v1.5 | 384 | 快速找到候选 |
| 重排 | BGE-M3-Distill-8L | 1024 | 精确排序（需要外部 API） |

## Main App 需要的改动

### 1. 安装依赖

```bash
npm install @xenova/transformers
```

### 2. 创建 Embedding 服务

创建 `lib/embeddings/query.ts`：

```typescript
import { pipeline, env } from '@xenova/transformers';

// 配置 WASM backend
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;
env.cacheDir = '/tmp/.transformers-cache';

const MODEL = 'Xenova/bge-small-en-v1.5'; // 384-dim
let pipeline_instance: any = null;

async function initModel() {
  if (pipeline_instance) return pipeline_instance;
  
  console.log('[Query Embeddings] Initializing bge-small-en...');
  pipeline_instance = await pipeline('feature-extraction', MODEL, {
    quantized: true,
  });
  console.log('[Query Embeddings] ✅ Model ready');
  
  return pipeline_instance;
}

/**
 * Generate 384-dim query embedding
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const model = await initModel();
  const output = await model(query, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data) as number[];
}
```

### 3. 更新搜索逻辑

#### 选项 A: 只使用 384-dim (推荐，简单)

```typescript
import { generateQueryEmbedding } from '@/lib/embeddings/query';

async function searchDocuments(query: string, limit: number = 10) {
  // 生成查询 embedding
  const queryEmbedding = await generateQueryEmbedding(query);
  
  // 使用 embedding_small 搜索
  const { data, error } = await supabase.rpc('search_chunks_small', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit
  });
  
  return data;
}
```

对应的 SQL 函数：

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

#### 选项 B: 两阶段搜索 (更精确，但复杂)

```typescript
import { generateQueryEmbedding } from '@/lib/embeddings/query';

async function searchDocumentsTwoStage(query: string, limit: number = 10) {
  // Stage 1: 使用 384-dim 粗筛，获取更多候选
  const queryEmbeddingSmall = await generateQueryEmbedding(query);
  
  const { data: candidates } = await supabase.rpc('search_chunks_small', {
    query_embedding: queryEmbeddingSmall,
    match_threshold: 0.6,
    match_count: limit * 3  // 获取 3x 候选
  });
  
  if (!candidates || candidates.length === 0) {
    return [];
  }
  
  // Stage 2: 使用 1024-dim 重排（如果可用）
  const chunksWithLarge = candidates.filter(c => c.embedding_large !== null);
  
  if (chunksWithLarge.length === 0) {
    // 降级：只返回 384-dim 结果
    return candidates.slice(0, limit);
  }
  
  // 调用外部 API 生成 1024-dim 查询 embedding
  const response = await fetch(`${process.env.BGE_HF_EMBEDDING_SERVER_API_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: query })
  });
  
  const { embedding: queryEmbeddingLarge } = await response.json();
  
  // 重新计算相似度并排序
  const reranked = chunksWithLarge.map(chunk => ({
    ...chunk,
    similarity_large: cosineSimilarity(queryEmbeddingLarge, chunk.embedding_large)
  })).sort((a, b) => b.similarity_large - a.similarity_large);
  
  return reranked.slice(0, limit);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### 4. 更新 Next.js 配置

在 Main App 的 `next.config.ts` 中添加：

```typescript
const nextConfig: NextConfig = {
  // ... 其他配置
  
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

### 5. 环境变量

在 Main App 的 `.env` 中添加（如果使用两阶段搜索）：

```bash
# 可选：用于 1024-dim 重排
BGE_HF_EMBEDDING_SERVER_API_URL=https://edusocial-bge-m3-embedding-server.hf.space
```

## 推荐方案

### 🎯 推荐：选项 A (只使用 384-dim)

**这是默认和推荐的方案**。

**优点**：
- ✅ 简单，易于实现
- ✅ 快速，无需外部 API 调用
- ✅ 稳定，不依赖外部服务
- ✅ 内存占用低 (~300MB)
- ✅ 完全免费

**缺点**：
- ❌ 精度略低于 1024-dim

**适用场景**：
- 大多数搜索场景
- 需要快速响应
- 不想依赖外部服务

**重要说明**：
- ⚠️ Crawler 仍然会生成 1024-dim embeddings（异步）
- ⚠️ 这些 embeddings 会保存在 `embedding_large` 字段
- ⚠️ 但查询时**默认不使用**，只用于未来可能的高级功能
- ⚠️ 这样既保证了查询效率，又为未来功能预留了数据

### 🔧 可选：选项 B (两阶段搜索)

**这是未来可选的高级功能，目前不推荐使用**。

**优点**：
- ✅ 更高的搜索精度
- ✅ 充分利用 1024-dim embeddings

**缺点**：
- ❌ 复杂度高
- ❌ 需要外部 API 调用
- ❌ 响应时间较长
- ❌ 依赖 HuggingFace Space 可用性

**适用场景**：
- 对搜索精度要求极高的特殊场景
- 可以接受较长响应时间
- 有备用方案处理外部 API 失败

**未来用途**：
- 高级搜索模式（用户可选）
- 特定领域的精确搜索
- A/B 测试对比搜索质量

## 迁移步骤

### 1. 准备阶段
- [ ] 在 Main App 安装 `@xenova/transformers`
- [ ] 更新 `next.config.ts`
- [ ] 创建 `lib/embeddings/query.ts`

### 2. 数据库迁移
- [ ] 确认 `document_chunks` 表有 `embedding_small` 和 `embedding_large` 列
- [ ] 创建新的搜索函数 `search_chunks_small`
- [ ] 测试搜索函数

### 3. 代码更新
- [ ] 更新搜索 API endpoint
- [ ] 更新前端搜索调用
- [ ] 添加错误处理和降级逻辑

### 4. 测试
- [ ] 测试 384-dim 搜索
- [ ] 测试 embedding 生成性能
- [ ] 测试内存占用
- [ ] 测试搜索结果质量

### 5. 部署
- [ ] 部署 Main App 更新
- [ ] 监控搜索性能
- [ ] 监控错误率

## 性能对比

| 指标 | 之前 (OpenAI) | 现在 (bge-small) | 现在 (两阶段) |
|------|---------------|------------------|---------------|
| 查询延迟 | ~200ms | ~100ms | ~500ms |
| 内存占用 | 0 (API) | ~300MB | ~300MB |
| 成本 | $0.0001/query | $0 | $0 |
| 搜索精度 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 稳定性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## 常见问题

### Q: 为什么不继续使用 OpenAI embeddings?
A: 为了完全免费运行，避免 API 成本。bge-small 在大多数场景下表现足够好。

### Q: 搜索质量会下降吗?
A: 384-dim 的 bge-small 在大多数场景下表现良好。如果需要更高精度，可以使用两阶段搜索。

### Q: 如果 embedding_large 为 null 怎么办?
A: 搜索会自动降级为只使用 embedding_small。这是正常的，因为 large embeddings 是异步生成的。

### Q: 需要重新索引所有文档吗?
A: 不需要。Crawler Service 会自动处理新文档。旧文档会在下次 crawler 运行时更新。

### Q: 可以混合使用新旧 embeddings 吗?
A: 不建议。建议等待所有文档都有新的 embeddings 后再切换搜索逻辑。

## 支持

如有问题，请查看：
- `EMBEDDING_ARCHITECTURE.md` - 详细架构说明
- `EMBEDDING_FIX.md` - 技术实现细节
- Crawler Service 日志 - 查看 embedding 生成状态
