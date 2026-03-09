# Crawler Service 实现总结

## ✅ 完整实现确认

Crawler service 在 **`/api/crawler/worker`** 里面完成所有处理，包括：

1. ✅ 爬取文档
2. ✅ 分块
3. ✅ 生成双 embedding (e5-small 384 + e5-large 1024)
4. ✅ 保存到数据库

## 📁 关键文件

### API Route: `/api/crawler/worker/route.ts`

这是核心文件，包含完整的处理流程。

#### 导入的库

```typescript
import { chunkDocument } from '@/lib/nlp/chunking';
import { generateBatchDualEmbeddings } from '@/lib/embeddings/server-dual';
```

#### 完整流程代码

```typescript
// Step 1: 爬取和标准化 (lines 50-150)
const htmlContent = await crawlHTML(url);
const normalizedDoc = normalizeHTMLDocument(htmlContent, source);

// 保存文档到 kb_documents
const { data: document } = await supabase
  .from('kb_documents')
  .insert({
    title: normalizedDoc.title,
    content: sanitizedContent,
    document_type: 'gov_crawled',
    // ...
  });

// Step 2: 分块 (lines 220-230)
const chunks = await chunkDocument(sanitizedContent, {
  chunkSize: 800,
  chunkOverlap: 100
});

// Step 3: 生成双 embedding (lines 250-260)
const chunkTexts = chunks.map(c => c.text);
const embeddings = await generateBatchDualEmbeddings(chunkTexts);
// 返回: [{ small: [384个数字], large: [1024个数字] }, ...]

// Step 4: 保存到 document_chunks (lines 265-280)
const chunksToInsert = chunks.map((chunk, index) => ({
  document_id: documentId,
  chunk_text: chunk.text,
  chunk_index: chunk.index,
  embedding_small: embeddings[index].small,  // 384-dim
  embedding_large: embeddings[index].large,  // 1024-dim
  token_count: chunk.tokenCount,
  language: normalizedDoc.metadata.language
}));

await supabase
  .from('document_chunks')
  .insert(chunksToInsert);
```

## 🔍 代码位置

### 1. Worker Route (主要逻辑)

**文件**: `Docs-Bridge-Crawler/app/api/crawler/worker/route.ts`

**行数**: ~310 行

**关键部分**:
- Lines 1-20: Imports (包括 embedding 和 chunking)
- Lines 50-150: 爬取和保存文档
- Lines 220-230: 分块
- Lines 250-260: 生成 embedding
- Lines 265-280: 保存 chunks 到数据库

### 2. Embedding 库

**文件**: `Docs-Bridge-Crawler/lib/embeddings/server-dual.ts`

**功能**:
```typescript
// 生成双 embedding
export async function generateBatchDualEmbeddings(
  texts: string[]
): Promise<Array<{ small: number[]; large: number[] }>>
```

**实现**:
- 使用 `@xenova/transformers`
- e5-small-v2 模型 (384-dim)
- e5-large-v2 模型 (1024-dim)
- 批量处理提高效率

### 3. Chunking 库

**文件**: `Docs-Bridge-Crawler/lib/nlp/chunking.ts`

**功能**:
```typescript
export async function chunkDocument(
  content: string,
  options: { chunkSize: number; chunkOverlap: number }
): Promise<Array<{ text: string; index: number; tokenCount: number }>>
```

**实现**:
- 使用 LangChain 的 `RecursiveCharacterTextSplitter`
- 智能分割（优先在段落边界）
- 保持语义完整性

## 📊 数据流图

```
POST /api/crawler/worker
        ↓
[QStash 验证签名]
        ↓
[爬取网站]
  • crawlHTML() 或 crawlPDF()
        ↓
[标准化文档]
  • normalizeHTMLDocument()
  • 质量评分
        ↓
[保存到 kb_documents]
  • document_id 生成
        ↓
[分块文档]
  • chunkDocument()
  • 800 tokens per chunk
  • 100 tokens overlap
        ↓
[生成双 Embedding]
  • generateBatchDualEmbeddings()
  • e5-small: 384-dim
  • e5-large: 1024-dim
        ↓
[保存到 document_chunks]
  • chunk_text
  • embedding_small (384)
  • embedding_large (1024)
  • token_count
  • language
        ↓
[返回成功响应]
  • document_id
  • chunks_created
  • quality_score
```

## 🔧 技术细节

### Embedding 生成

**Prefix 规则** (e5 模型要求):

```typescript
// 文档使用 "passage:" prefix
const embeddings = await generateBatchDualEmbeddings([
  "passage: 政府补助申请需要提交身份证明...",
  "passage: 医疗补助的申请流程包括...",
]);

// 查询使用 "query:" prefix (在主应用)
const queryEmbedding = await generateSmallEmbedding(
  "query: 如何申请医疗补助?"
);
```

### 批量处理

```typescript
// ❌ 慢 - 逐个生成
for (const chunk of chunks) {
  const embedding = await generateEmbedding(chunk);
}

// ✅ 快 - 批量生成
const embeddings = await generateBatchDualEmbeddings(chunkTexts);
```

### 数据库保存

```typescript
// 一次性插入所有 chunks
await supabase
  .from('document_chunks')
  .insert([
    {
      document_id: 'abc-123',
      chunk_text: 'chunk 1...',
      embedding_small: [0.1, 0.2, ...], // 384 个数字
      embedding_large: [0.3, 0.4, ...], // 1024 个数字
      token_count: 150,
      language: 'ms'
    },
    // ... 更多 chunks
  ]);
```

## 📝 日志输出

运行时会看到这些日志：

```
[Crawler Worker] ========================================
[Crawler Worker] Processing crawl job...
[Crawler Worker] Source ID: moh-subsidy-guide
[Crawler Worker] Crawling HTML: https://...
[Crawler Worker] ✅ Crawled: MOH Subsidy Guidelines
[Crawler Worker] Quality score: 85/100
[Crawler Worker] Word count: 1500
[Crawler Worker] ✅ Saved document: abc-123-def-456
[Crawler Worker] ========================================
[Crawler Worker] Starting document processing...
[Crawler Worker] Step 1: Chunking document...
[Crawler Worker] Created 12 chunks
[Crawler Worker] Step 2: Generating embeddings with e5-large (1024-dim)...
[Crawler Worker] Using dual embedding strategy:
[Crawler Worker] - Small (384-dim): for fast coarse search
[Crawler Worker] - Large (1024-dim): for accurate reranking
[Crawler Worker] Generated 12 dual embeddings
[Crawler Worker] Step 3: Saving chunks with dual embeddings...
[Crawler Worker] ✅ Saved 12 chunks with dual embeddings
[Crawler Worker] ✅ Crawl and processing completed successfully
[Crawler Worker] ========================================
```

## 🗄️ 数据库结果

### kb_documents 表

```sql
SELECT id, title, document_type, trust_level 
FROM kb_documents 
WHERE document_type = 'gov_crawled'
LIMIT 1;
```

结果:
```
id: abc-123-def-456
title: MOH Subsidy Guidelines
document_type: gov_crawled
trust_level: 4
```

### document_chunks 表

```sql
SELECT 
  id, 
  document_id, 
  chunk_index,
  token_count,
  array_length(embedding_small, 1) as small_dim,
  array_length(embedding_large, 1) as large_dim
FROM document_chunks 
WHERE document_id = 'abc-123-def-456'
LIMIT 3;
```

结果:
```
id: chunk-1
document_id: abc-123-def-456
chunk_index: 0
token_count: 150
small_dim: 384
large_dim: 1024

id: chunk-2
document_id: abc-123-def-456
chunk_index: 1
token_count: 145
small_dim: 384
large_dim: 1024

id: chunk-3
document_id: abc-123-def-456
chunk_index: 2
token_count: 160
small_dim: 384
large_dim: 1024
```

## ✅ 验证清单

部署后验证这些：

- [ ] Worker endpoint 可访问
- [ ] QStash 任务成功触发
- [ ] 文档保存到 `kb_documents`
- [ ] Chunks 保存到 `document_chunks`
- [ ] `embedding_small` 是 384 维
- [ ] `embedding_large` 是 1024 维
- [ ] 日志显示 "Generated X dual embeddings"
- [ ] 日志显示 "Saved X chunks with dual embeddings"

## 🔍 调试命令

### 检查文档

```sql
SELECT 
  id, 
  title, 
  document_type,
  created_at
FROM kb_documents 
WHERE document_type = 'gov_crawled'
ORDER BY created_at DESC
LIMIT 5;
```

### 检查 Chunks

```sql
SELECT 
  dc.id,
  dc.chunk_index,
  dc.token_count,
  array_length(dc.embedding_small, 1) as small_dim,
  array_length(dc.embedding_large, 1) as large_dim,
  d.title
FROM document_chunks dc
JOIN kb_documents d ON dc.document_id = d.id
WHERE d.document_type = 'gov_crawled'
ORDER BY dc.created_at DESC
LIMIT 10;
```

### 检查 Embedding 质量

```sql
-- 检查 embedding 是否都是有效数字
SELECT 
  id,
  chunk_index,
  embedding_small[1] as first_small,
  embedding_large[1] as first_large
FROM document_chunks
WHERE document_id = 'YOUR_DOCUMENT_ID'
LIMIT 5;
```

## 🎯 总结

**是的，所有代码都在 `/api/crawler/worker` 里面！**

- ✅ 爬取: `crawlHTML()` / `crawlPDF()`
- ✅ 分块: `chunkDocument()`
- ✅ Embedding: `generateBatchDualEmbeddings()`
- ✅ 保存: `supabase.from('document_chunks').insert()`

**不需要额外的 page 或 API**，所有逻辑都在 worker route 里完成。

**Page (`app/page.tsx`)** 只是一个简单的欢迎页面，展示 API 端点列表，不参与处理流程。
