# DocsBridge Crawler Service

独立的政府文档爬虫服务，负责自动抓取、处理和 embedding 政府网站内容。

## 🎯 架构

```
Docs-Bridge-Crawler (Vercel)          DocsBridge Main App (Vercel)
        ↓                                      ↓
   Vercel Cron                          RAG Query Interface
        ↓                                      ↓
   QStash Queue                         Hybrid Retrieval
        ↓                                      ↓
   Crawler Worker                       (384-dim coarse search
        ↓                                + 1024-dim reranking)
   Crawl Websites
        ↓
   Chunk Documents
        ↓
   Generate Dual Embeddings
   (e5-small 384 + e5-large 1024)
        ↓
   Save to Supabase
   (kb_documents + document_chunks)
```

## 🌟 特性

- ✅ **完整处理流程**: 爬取 → 分块 → Embedding → 存储，一站式完成
- ✅ **双 Embedding 架构**: 
  - e5-small (384-dim) 用于快速粗筛
  - e5-large (1024-dim) 用于精确重排
- ✅ **独立部署**: 与主应用分离，可独立扩展
- ✅ **自动调度**: Vercel Cron 自动触发爬取任务
- ✅ **队列处理**: QStash 提供可靠的消息队列和重试机制
- ✅ **25个数据源**: 涵盖马来西亚和新加坡政府网站
- ✅ **智能爬取**: 支持 HTML 和 PDF 文档
- ✅ **质量评分**: 自动评估文档质量 (0-100)
- ✅ **健康检查**: 提供服务状态监控端点

## 📁 项目结构

```
Docs-Bridge-Crawler/
├── app/
│   ├── layout.tsx                       # Next.js 15 根布局
│   ├── page.tsx                         # 服务首页
│   └── api/
│       ├── crawler/
│       │   ├── worker/route.ts          # QStash worker (爬取文档)
│       │   └── cron/
│       │       ├── daily/route.ts       # 每日定时任务
│       │       ├── weekly/route.ts      # 每周定时任务
│       │       └── monthly/route.ts     # 每月定时任务
│       └── health/route.ts              # 健康检查
├── lib/
│   ├── crawler/
│   │   ├── html.ts                      # HTML 爬虫
│   │   ├── pdf.ts                       # PDF 爬虫
│   │   ├── normalize.ts                 # 文档标准化
│   │   └── sources.ts                   # 数据源配置 (25个政府网站)
│   ├── supabase/
│   │   └── client.ts                    # Supabase 客户端 (service role)
│   └── qstash/
│       └── client.ts                    # QStash 客户端
├── package.json                         # 依赖配置
├── tsconfig.json                        # TypeScript 配置
├── next.config.ts                       # Next.js 配置
├── vercel.json                          # Vercel Cron 配置
├── .env.example                         # 环境变量示例
├── .gitignore                           # Git 忽略文件
├── README.md                            # 本文件
├── DEPLOYMENT.md                        # 部署指南
└── MIGRATION_FROM_MAIN_APP.md          # 迁移指南
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd Docs-Bridge-Crawler
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local`:

```bash
cp .env.example .env.local
```

编辑 `.env.local`:

```env
# Supabase (与主应用共享同一个数据库)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# QStash (Upstash)
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key

# Vercel Cron Secret (生成: openssl rand -hex 32)
CRON_SECRET=your_cron_secret_here

# 系统用户 ID
SYSTEM_USER_ID=00000000-0000-0000-0000-000000000000
```

**注意**: 不再需要 `DOCSBRIDGE_APP_URL`，因为 crawler 自己完成所有处理。

### 3. 本地开发

```bash
npm run dev
```

服务将在 `http://localhost:3001` 启动

### 4. 测试健康检查

```bash
curl http://localhost:3001/api/health
```

响应示例:
```json
{
  "status": "healthy",
  "service": "docs-bridge-crawler",
  "version": "1.0.0",
  "sources": {
    "total": 25,
    "by_frequency": {
      "daily": 5,
      "weekly": 10,
      "monthly": 10
    },
    "by_category": {
      "healthcare": 8,
      "finance": 7,
      "education": 5,
      "housing": 3,
      "employment": 2
    }
  }
}
```

### 5. 构建测试

```bash
npm run build
```

## 📊 数据源

当前配置了 **25 个政府数据源**，涵盖:

### 马来西亚 (Malaysia)
- **医疗保健**: MOH 补助指南、MySalam、Peka B40
- **财务援助**: STR、Bantuan Prihatin Rakyat、Bantuan Sara Hidup
- **教育**: PTPTN、Skim Bantuan Pendidikan
- **住房**: PR1MA、Rumah Mampu Milik
- **就业**: PERKESO、EIS

### 新加坡 (Singapore)
- **医疗保健**: MediShield Life、CHAS、ElderShield
- **财务援助**: ComCare、Silver Support、GST Voucher
- **教育**: MOE Financial Assistance、Edusave
- **住房**: HDB Grants、CPF Housing
- **就业**: SkillsFuture、Workfare

详见 `lib/crawler/sources.ts`

## ⏰ Cron 调度

配置在 `vercel.json`:

- **Daily** (每日 2:00 AM UTC): `0 2 * * *`
  - 爬取 5 个高频更新的数据源
  
- **Weekly** (每周日 3:00 AM UTC): `0 3 * * 0`
  - 爬取 10 个中频更新的数据源
  
- **Monthly** (每月 1 号 4:00 AM UTC): `0 4 1 * *`
  - 爬取 10 个低频更新的数据源

## 🔄 工作流程

1. **Vercel Cron** 按计划触发 cron 端点
2. **Cron Route** 筛选对应频率的数据源
3. **Cron Route** 为每个数据源创建 QStash 任务
4. **QStash** 将任务分发到 worker 端点（带重试）
5. **Worker** 爬取网站内容（HTML 或 PDF）
6. **Worker** 标准化和验证文档
7. **Worker** 保存文档到 Supabase `kb_documents` 表
8. **Worker** 分块文档（500-800 tokens per chunk）
9. **Worker** 生成双 embeddings：
   - e5-small (384-dim) - 快速粗筛
   - e5-large (1024-dim) - 精确重排
10. **Worker** 保存 chunks 和 embeddings 到 `document_chunks` 表
11. **Main App** 用户查询时使用混合检索：
    - 先用 384-dim 快速找到 30 个候选
    - 再用 1024-dim 精确重排到 top 5

## 🛠️ API 端点

### GET /api/health

健康检查端点

**响应:**
```json
{
  "status": "healthy",
  "service": "docs-bridge-crawler",
  "sources": { ... }
}
```

### POST /api/crawler/worker

QStash worker 端点（由 QStash 调用）

**请求体:**
```json
{
  "source_id": "moh-subsidy-guide",
  "triggered_by": "cron_daily",
  "timestamp": "2024-03-09T02:00:00Z"
}
```

**响应:**
```json
{
  "success": true,
  "document_id": "abc-123",
  "source_id": "moh-subsidy-guide",
  "title": "MOH Subsidy Guidelines",
  "word_count": 1500,
  "quality_score": 85,
  "action": "created"
}
```

### GET /api/crawler/cron/daily

每日 cron 端点（由 Vercel Cron 调用）

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**响应:**
```json
{
  "success": true,
  "queued": 5,
  "failed": 0,
  "jobs": [...]
}
```

### GET /api/crawler/cron/weekly

每周 cron 端点

### GET /api/crawler/cron/monthly

每月 cron 端点

## 🚢 部署到 Vercel

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

简要步骤:

1. 推送代码到 Git 仓库
2. 在 Vercel 导入项目
3. 配置环境变量
4. 部署
5. 验证 cron jobs 已创建
6. 测试健康检查和手动触发

## 🧪 测试

### 手动触发爬取

```bash
# 触发每日爬取
curl -X GET https://your-crawler-service.vercel.app/api/crawler/cron/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 查看日志

Vercel Dashboard → Functions → Logs

查找 `[Crawler Worker]` 日志

### 验证数据库

```sql
-- 查看最新爬取的文档
SELECT id, title, document_type, trust_level, created_at
FROM kb_documents
WHERE document_type = 'gov_crawled'
ORDER BY created_at DESC
LIMIT 10;

-- 查看文档块
SELECT dc.id, dc.chunk_index, d.title
FROM document_chunks dc
JOIN kb_documents d ON dc.document_id = d.id
WHERE d.document_type = 'gov_crawled'
ORDER BY dc.created_at DESC
LIMIT 10;
```

## 🐛 故障排除

### Cron 未触发

- 检查 Vercel Dashboard → Cron Jobs
- 确认项目在支持 cron 的计划上（Pro+）
- 重新部署以刷新 cron 配置

### Worker 失败

- 检查 Vercel 函数日志
- 验证环境变量设置正确
- 测试 Supabase 连接
- 检查 QStash 签名密钥

### 文档未处理

- 验证 `DOCSBRIDGE_APP_URL` 正确
- 测试主应用的处理端点
- 确认主应用支持 `system_call: true`

## 📈 监控

### 关键指标

- **爬取成功率**: QStash dashboard
- **文档质量分数**: Supabase `quality_score` 字段
- **处理时间**: Vercel 函数执行时间
- **存储增长**: Supabase 数据库大小

### 建议的告警

- Vercel 部署失败通知
- QStash 失败消息告警
- Supabase 存储使用告警

## 🔐 安全

- ✅ QStash 签名验证
- ✅ Cron secret 认证
- ✅ Supabase service role 隔离
- ✅ 主应用回调使用 `system_call` 标志
- ✅ 环境变量加密存储

## 📚 相关文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 完整部署指南
- [MIGRATION_FROM_MAIN_APP.md](./MIGRATION_FROM_MAIN_APP.md) - 从主应用迁移指南
- 主应用的 `DUAL_EMBEDDING_SUMMARY.md` - Embedding 架构
- 主应用的 `EMBEDDING_IMPLEMENTATION_STATUS.md` - 实现细节

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 许可

MIT

## 🎉 致谢

- Next.js 15 - Web 框架
- Vercel - 部署平台
- Supabase - 数据库
- Upstash QStash - 消息队列
- Cheerio - HTML 解析
- pdf-parse - PDF 解析
