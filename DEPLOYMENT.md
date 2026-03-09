# Crawler Service 部署指南

## 📋 前置条件

- [x] Vercel 账号
- [x] Supabase 项目 (与主应用共享)
- [x] Upstash QStash 账号
- [x] 主应用已部署

## 🚀 部署步骤

### Step 1: 准备代码

```bash
cd Docs-Bridge-Crawler
npm install
npm run build  # 测试构建
```

### Step 2: 推送到 Git

```bash
git init
git add .
git commit -m "Initial crawler service"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

### Step 3: 在 Vercel 创建项目

1. 登录 Vercel Dashboard
2. 点击 "Add New" → "Project"
3. Import Git Repository
4. 选择 `Docs-Bridge-Crawler` 仓库
5. 配置项目:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (如果是 monorepo 则指定目录)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### Step 4: 配置环境变量

在 Vercel Project Settings → Environment Variables 添加:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# QStash
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=xxx
QSTASH_NEXT_SIGNING_KEY=xxx

# Cron Secret (生成一个随机字符串)
CRON_SECRET=your_random_secret_here

# 主应用 URL
DOCSBRIDGE_APP_URL=https://your-main-app.vercel.app

# 系统用户 ID
SYSTEM_USER_ID=00000000-0000-0000-0000-000000000000
```

**生成 CRON_SECRET:**
```bash
openssl rand -hex 32
```

### Step 5: 部署

点击 "Deploy" 按钮，等待部署完成

### Step 6: 验证部署

```bash
# 检查健康状态
curl https://your-crawler-service.vercel.app/api/health

# 应该返回:
# {
#   "status": "healthy",
#   "service": "docs-bridge-crawler",
#   "sources": { ... }
# }
```

### Step 7: 验证 Cron Jobs

1. 在 Vercel Dashboard → Project → Cron Jobs
2. 应该看到 3 个 cron jobs:
   - `/api/crawler/cron/daily` - 每日 2:00 AM
   - `/api/crawler/cron/weekly` - 每周日 3:00 AM
   - `/api/crawler/cron/monthly` - 每月 1 号 4:00 AM

### Step 8: 手动测试爬取

```bash
# 触发每日爬取
curl -X GET https://your-crawler-service.vercel.app/api/crawler/cron/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 检查响应:
# {
#   "success": true,
#   "queued": X,
#   "failed": 0,
#   "jobs": [...]
# }
```

### Step 9: 监控日志

1. Vercel Dashboard → Functions → Logs
2. 查找 `[Crawler Worker]` 日志
3. 确认文档被成功爬取和保存

## ✅ 验证清单

部署成功的标志:

- [ ] Health check 返回 200
- [ ] Cron jobs 在 Vercel Dashboard 显示
- [ ] 手动触发 cron 成功
- [ ] Worker 日志显示爬取成功
- [ ] Supabase `kb_documents` 表有新文档
- [ ] 主应用收到处理回调
- [ ] `document_chunks` 表有新 chunks

## 🔧 配置主应用

确保主应用的 `/api/kb/documents/[id]/process` 支持 `system_call: true`:

```typescript
// 主应用: app/api/kb/documents/[id]/process/route.ts
const { force_reprocess = false, system_call = false } = body;

if (!system_call) {
  // 检查认证
}
```

## 🐛 故障排除

### Issue: Cron 未触发

**检查:**
1. `vercel.json` 是否正确配置
2. Vercel Dashboard → Cron Jobs 是否显示
3. 项目是否在 Pro plan (免费版有限制)

**解决:**
```bash
# 确保 vercel.json 存在
cat vercel.json

# 重新部署
git commit --allow-empty -m "Trigger redeploy"
git push
```

### Issue: 401 Unauthorized

**原因:** `CRON_SECRET` 不匹配

**解决:**
1. 检查环境变量是否设置
2. 确认 Authorization header 格式: `Bearer YOUR_SECRET`

### Issue: QStash 签名验证失败

**原因:** QStash keys 不正确

**解决:**
1. 登录 Upstash Console
2. 复制最新的 signing keys
3. 更新 Vercel 环境变量
4. 重新部署

### Issue: 文档未保存到数据库

**原因:** Supabase 连接问题

**解决:**
1. 检查 Supabase URL 和 keys
2. 确认 `SYSTEM_USER_ID` 存在
3. 检查 RLS policies

### Issue: 主应用未收到回调

**原因:** `DOCSBRIDGE_APP_URL` 不正确

**解决:**
1. 确认主应用 URL 正确
2. 测试主应用的 process endpoint:
```bash
curl -X POST https://your-main-app.vercel.app/api/kb/documents/TEST_ID/process \
  -H "Content-Type: application/json" \
  -d '{"system_call": true, "force_reprocess": true}'
```

## 📊 监控和维护

### 查看爬取统计

```bash
curl https://your-crawler-service.vercel.app/api/health
```

### 查看 QStash 队列

1. 登录 Upstash Console
2. QStash → Messages
3. 查看队列状态和失败消息

### 查看 Vercel 日志

```bash
vercel logs your-crawler-service --follow
```

### 定期检查

- 每周检查爬取成功率
- 每月检查数据源是否仍然可访问
- 监控 Vercel 函数执行时间

## 🔄 更新部署

### 添加新数据源

1. 编辑 `lib/crawler/sources.ts`
2. 提交并推送
3. Vercel 自动部署

### 修改 Cron 调度

1. 编辑 `vercel.json`
2. 提交并推送
3. Vercel 自动更新 cron jobs

## 📝 下一步

- [ ] 设置 Vercel 通知 (部署失败时)
- [ ] 配置 Sentry 错误追踪
- [ ] 添加更多政府数据源
- [ ] 优化爬取性能

## 🎉 完成！

你的 crawler 服务现在已经独立运行在 Vercel 上，会自动爬取政府文档并发送到主应用处理。
