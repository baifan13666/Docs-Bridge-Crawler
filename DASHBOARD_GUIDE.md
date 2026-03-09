# Dashboard 使用指南

## 📊 实时监控 Dashboard

Crawler service 现在包含一个实时监控 dashboard，可以直观地查看爬取结果。

## 🌐 访问 Dashboard

### 本地开发

```bash
cd Docs-Bridge-Crawler
npm run dev
```

然后访问: `http://localhost:3001/dashboard`

### 生产环境

部署到 Vercel 后访问: `https://your-crawler-service.vercel.app/dashboard`

## 📈 Dashboard 功能

### 1. 统计卡片

显示关键指标：

- **Total Documents**: 已爬取的文档总数
- **Total Chunks**: 生成的文档块总数
- **Avg Quality Score**: 平均质量分数 (0-100)
- **Documents Today**: 今天爬取的文档数

### 2. 最近文档列表

显示最近 20 个爬取的文档：

- **Title**: 文档标题
- **Trust Level**: 信任等级 (1-5)
  - Level 5: 最高信任 (绿色)
  - Level 4: 高信任 (蓝色)
  - Level 3: 中等信任 (橙色)
  - Level 2-1: 低信任 (红色)
- **Chunks**: 该文档生成的块数量
- **Created At**: 爬取时间

### 3. 自动刷新

Dashboard 每 10 秒自动刷新一次，实时显示最新数据。

也可以点击 "🔄 Refresh" 按钮手动刷新。

## 🎨 界面设计

- **深色主题**: 专业的深色界面，减少眼睛疲劳
- **响应式设计**: 适配桌面和移动设备
- **实时更新**: 自动刷新显示最新数据
- **清晰的视觉层次**: 使用颜色和间距突出重要信息

## 🔧 技术实现

### 前端 (Client Component)

**文件**: `app/dashboard/page.tsx`

```typescript
'use client';

// 使用 React hooks 管理状态
const [documents, setDocuments] = useState<Document[]>([]);
const [stats, setStats] = useState<Stats | null>(null);

// 每 10 秒自动刷新
useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 10000);
  return () => clearInterval(interval);
}, []);

// 从 API 获取数据
async function fetchData() {
  const response = await fetch('/api/dashboard/stats');
  const data = await response.json();
  setDocuments(data.documents);
  setStats(data.stats);
}
```

### 后端 API

**文件**: `app/api/dashboard/stats/route.ts`

```typescript
export async function GET() {
  const supabase = createClient();

  // 获取最近 20 个文档
  const { data: documents } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('document_type', 'gov_crawled')
    .order('created_at', { ascending: false })
    .limit(20);

  // 获取每个文档的 chunk 数量
  const documentsWithChunks = await Promise.all(
    documents.map(async (doc) => {
      const { count } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc.id);
      
      return { ...doc, chunk_count: count };
    })
  );

  // 获取统计数据
  const stats = {
    total_documents: ...,
    total_chunks: ...,
    avg_quality_score: ...,
    documents_today: ...
  };

  return NextResponse.json({
    documents: documentsWithChunks,
    stats
  });
}
```

## 📊 数据流

```
Dashboard Page (Client)
        ↓
   [每 10 秒]
        ↓
GET /api/dashboard/stats
        ↓
   Supabase Query
        ↓
   kb_documents (最近 20 个)
        ↓
   document_chunks (每个文档的 chunk 数)
        ↓
   统计计算
        ↓
   返回 JSON
        ↓
   更新 UI
```

## 🎯 使用场景

### 1. 监控爬取进度

部署后，打开 dashboard 查看：
- 是否有新文档被爬取
- 每个文档生成了多少 chunks
- 文档质量分数是否符合预期

### 2. 调试问题

如果发现问题：
- 检查最近的文档是否正常
- 查看 chunk 数量是否合理
- 确认 trust level 是否正确

### 3. 性能监控

观察：
- 每天爬取的文档数量
- 总文档和 chunk 数量增长趋势
- 平均质量分数变化

## 🔍 示例数据

### 正常状态

```
Total Documents: 125
Total Chunks: 1,847
Avg Quality Score: 85.3/100
Documents Today: 5

Recent Documents:
┌─────────────────────────────────────┬──────────┬────────┬─────────────────────┐
│ Title                               │ Trust    │ Chunks │ Created At          │
├─────────────────────────────────────┼──────────┼────────┼─────────────────────┤
│ MOH Subsidy Guidelines              │ Level 4  │ 12     │ 2024-03-09 10:30:00 │
│ MySalam Application Process         │ Level 5  │ 15     │ 2024-03-09 10:25:00 │
│ PTPTN Loan Information              │ Level 4  │ 10     │ 2024-03-09 10:20:00 │
└─────────────────────────────────────┴──────────┴────────┴─────────────────────┘
```

### 异常状态

如果看到：
- **Chunks = 0**: 文档太短或分块失败
- **Trust Level = 1-2**: 文档质量低
- **Documents Today = 0**: Cron 可能未运行

## 🚀 部署后验证

1. **访问主页**: `https://your-crawler.vercel.app/`
2. **点击 "📊 View Dashboard"**
3. **确认显示**:
   - 统计卡片有数据
   - 文档列表显示最近爬取的文档
   - 每个文档有 chunk 数量
   - 自动刷新工作正常

## 🎨 自定义

### 修改刷新间隔

编辑 `app/dashboard/page.tsx`:

```typescript
// 改为 30 秒刷新一次
const interval = setInterval(fetchData, 30000);
```

### 修改显示数量

编辑 `app/api/dashboard/stats/route.ts`:

```typescript
// 显示最近 50 个文档
.limit(50);
```

### 修改颜色主题

编辑 `app/dashboard/page.tsx` 的 style 对象：

```typescript
backgroundColor: '#0f172a',  // 深色背景
color: '#e2e8f0',            // 浅色文字
```

## 📱 移动端支持

Dashboard 使用响应式设计，在手机上也能正常显示：

- 统计卡片自动换行
- 表格可以横向滚动
- 按钮和文字大小适配

## 🔐 安全性

Dashboard 目前是公开的，任何人都可以访问。

如果需要添加认证：

1. 添加 middleware 检查 auth
2. 或者在 API route 里检查 token
3. 或者使用 Vercel 的 password protection

## 📝 总结

Dashboard 提供了：

- ✅ 实时监控爬取结果
- ✅ 清晰的统计数据
- ✅ 最近文档列表
- ✅ 自动刷新
- ✅ 响应式设计
- ✅ 深色主题

现在你可以直观地看到 crawler 的工作状态！
