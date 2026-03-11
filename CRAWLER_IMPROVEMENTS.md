# Document Crawler 改进建议

## 🔍 一致性分析结果

### ✅ 良好的一致性
- 表结构设计完善，支持所有crawler需要的字段
- Embedding架构正确（384-dim + 1024-dim双embedding策略）
- 文档类型标识清晰（`document_type = 'gov_crawled'`）
- 信任级别机制完整

### ❌ 发现的问题

#### 1. **Crawler Jobs表未被使用**
- 表结构存在但crawler worker中没有使用
- 缺少批量爬取进度跟踪
- 无法监控爬取任务状态

#### 2. **Metadata利用不足**
- 数据库支持丰富的JSONB metadata
- 当前实现只存储基础信息
- 缺少部门分类、爬取性能等数据

#### 3. **缺少批量管理**
- Sources.ts定义了500+政府网站
- 只有单文档处理，没有批量爬取
- 缺少失败重试机制

## 🚀 已实现的改进

### 1. **Job Manager系统**
```typescript
// lib/crawler/job-manager.ts
export class CrawlerJobManager {
  async createBatchJob(): Promise<string>
  async updateJobProgress(jobId: string, docs: number, chunks: number)
  async completeJob(jobId: string)
  async failJob(jobId: string, error: string)
}
```

### 2. **增强Metadata收集**
```typescript
// lib/crawler/normalize.ts - 新增字段
metadata: {
  // 性能数据
  crawl_duration_ms: 2301,
  file_type: 'html',
  
  // 分类信息
  department: 'DSWD',
  priority: 'high',
  content_type: 'guide',
  
  // 质量指标
  quality_score: 85,
  has_structured_data: false,
  
  // SEO数据
  meta_description: "...",
  keywords: ["welfare", "assistance"]
}
```

### 3. **批量爬取API**
```typescript
// POST /api/crawler/batch
{
  "priority": "high",     // 可选: high/medium/low
  "country": "malaysia",  // 可选: malaysia/philippines/singapore
  "category": "healthcare" // 可选: 按类别过滤
}

// 返回
{
  "job_id": "uuid",
  "sources_queued": 25,
  "estimated_completion": "2026-03-11T12:30:00Z"
}
```

### 4. **分析仪表板API**
```typescript
// GET /api/crawler/analytics
{
  "overview": {
    "total_documents": 150,
    "total_chunks": 1200,
    "embedding_completion": "95%"
  },
  "breakdown": {
    "by_country": { "malaysia": 50, "philippines": 60 },
    "by_department": { "DSWD": 25, "DOH": 30 }
  },
  "quality": {
    "popular_chunks": [...],
    "duplicate_chunks": 5,
    "documents_needing_recrawl": 12
  }
}
```

## 📊 使用建议

### 立即可用的改进

1. **启用批量爬取**
```bash
curl -X POST http://localhost:3000/api/crawler/batch \
  -H "Content-Type: application/json" \
  -d '{"priority": "high", "country": "malaysia"}'
```

2. **监控爬取状态**
```bash
curl "http://localhost:3000/api/crawler/analytics"
```

3. **查看数据质量**
```sql
-- 使用数据库增强脚本中的函数
SELECT * FROM get_popular_chunks(10);
SELECT * FROM find_duplicate_chunks();
SELECT * FROM get_documents_needing_recrawl();
```

### 数据库优化建议

1. **运行清理脚本**
```sql
-- 删除重复chunks
SELECT remove_duplicate_chunks();

-- 更新缺失的metadata
UPDATE kb_documents 
SET metadata = metadata || '{"department": "Unknown"}'::jsonb
WHERE metadata->>'department' IS NULL;
```

2. **创建有用的索引**
```sql
-- 按部门查询
CREATE INDEX idx_documents_department 
ON kb_documents USING gin((metadata->>'department'));

-- 按国家查询
CREATE INDEX idx_documents_country 
ON kb_documents USING gin((metadata->>'country'));
```

## 🎯 下一步行动

### 优先级1 - 立即实施
- [ ] 部署批量爬取API
- [ ] 运行一次完整的批量爬取测试
- [ ] 检查数据质量和重复项

### 优先级2 - 短期改进
- [ ] 实现失败重试机制
- [ ] 添加爬取频率智能调度
- [ ] 创建管理界面

### 优先级3 - 长期优化
- [ ] 实现增量更新检测
- [ ] 添加内容变化监控
- [ ] 优化embedding生成性能

## 📈 预期效果

实施这些改进后，你将获得：

1. **完整的批量管理** - 一键爬取500+政府网站
2. **详细的进度跟踪** - 实时监控爬取状态
3. **丰富的数据分析** - 了解内容质量和分布
4. **自动化维护** - 识别和清理重复内容
5. **智能调度** - 根据更新频率优化爬取

总体而言，你的crawler实现已经很好了，这些改进将让它更加完整和生产就绪！