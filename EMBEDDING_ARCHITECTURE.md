# Embedding 架构说明

## 概述

采用两阶段异步 embedding 生成策略，优化内存使用和处理速度。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Crawler Worker (同步)                              │
│ ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐ │
│ │ Crawl HTML  │ -> │ Chunk Text   │ -> │ Generate 384-dim│ │
│ │             │    │              │    │ (bge-small-en)  │ │
│ └─────────────┘    └──────────────┘    └─────────────────┘ │
│                                                ↓             │
│                                         ┌─────────────────┐ │
│                                         │ Save to DB      │ │
│                                         │ (small: 384-dim)│ │
│                                         │ (large: null)   │ │
│                                         └─────────────────┘ │
│                                                ↓             │
│                                         ┌─────────────────┐ │
│                                         │ Queue QStash    │ │
│                                         └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                                ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Large Embedding Worker (异步)                      │
│ ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐ │
│ │ QStash      │ -> │ Fetch Chunks │ -> │ Call External   │ │
│ │ Trigger     │    │ from DB      │    │ API (BGE-M3)    │ │
│ └─────────────┘    └──────────────┘    └─────────────────┘ │
│                                                ↓             │
│                                         ┌─────────────────┐ │
│                                         │ Update DB       │ │
│                                         │ (large:1024-dim)│ │
│                                         └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 模型

### Phase 1: 本地生成 (384-dim)
- **模型**: bge-small-en-v1.5
- **维度**: 384
- **运行环境**: Vercel Node.js + WASM
- **内存占用**: ~300-400MB
- **用途**: 快速粗筛搜索

### Phase 2: 外部 API (1024-dim)
- **模型**: BGE-M3-Distill-8L (via HuggingFace Space)
- **维度**: 1024
- **运行环境**: 外部 GPU 服务器
- **API**: `https://edusocial-bge-m3-embedding-server.hf.space`
- **用途**: 精确重排

## 优势

1. **内存优化**: 本地只加载一个小模型，避免 OOM
2. **速度优化**: Crawler 不等待大模型，快速完成
3. **质量保证**: 最终仍然有高质量的 1024-dim embeddings
4. **成本优化**: 外部 API 免费（HuggingFace Space）
5. **可扩展**: 可以轻松切换到其他 embedding 服务

## 环境变量

```bash
# Vercel 部署 URL
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app

# BGE M3 Embedding Server
BGE_HF_EMBEDDING_SERVER_API_URL=https://edusocial-bge-m3-embedding-server.hf.space
```

## API Endpoints

### POST /api/crawler/worker
- 爬取文档
- 生成 384-dim embeddings
- 保存到数据库
- 触发 QStash 任务

### POST /api/embeddings/large
- 从数据库获取 chunks
- 调用外部 API 生成 1024-dim embeddings
- 更新数据库

## 数据库 Schema

```sql
document_chunks (
  id uuid,
  document_id uuid,
  chunk_text text,
  embedding_small vector(384),  -- Phase 1: 立即生成
  embedding_large vector(1024), -- Phase 2: 异步生成
  ...
)
```

## 搜索策略

1. **粗筛**: 使用 `embedding_small` (384-dim) 快速找到候选
2. **重排**: 使用 `embedding_large` (1024-dim) 精确排序
3. **降级**: 如果 `embedding_large` 为 null，只用 `embedding_small`

## 故障处理

### HuggingFace Space Sleep
- **问题**: HuggingFace Space 闲置后会 sleep
- **解决**: 
  - 检测 503 状态码
  - 指数退避重试（5s, 10s, 20s）
  - 最多重试 3 次
  - 第一次请求会唤醒 Space（需要等待）

### 批处理策略
- 每批处理 10 个 chunks
- 避免单次请求超时
- 每批独立重试

### 如果外部 API 失败
- Crawler 仍然成功完成
- 搜索降级为只使用 384-dim
- QStash 会自动重试失败的任务
- 可以手动重新触发 `/api/embeddings/large`

### 如果 QStash 失败
- Crawler 记录警告但不失败
- 可以手动触发 `/api/embeddings/large`
- 或者等待下次 crawler 运行时重新触发

## 性能指标

- **Crawler 完成时间**: 5-15 秒（不等待大模型）
- **Large Embedding 处理时间**: 
  - Space 已唤醒: 10-30 秒
  - Space 需要唤醒: 30-90 秒（首次请求）
- **批处理**: 每批 10 个 chunks
- **重试策略**: 最多 3 次，指数退避（5s, 10s, 20s）
- **内存占用**: ~400MB（Crawler）
- **成本**: 完全免费
