# Migration Guide: Separating Crawler from Main App

This guide explains how to complete the separation of the crawler service from the main DocsBridge application.

## ✅ What's Already Done

The crawler service is now a fully independent Next.js 15 application with:

- ✅ All crawler library files (`html.ts`, `pdf.ts`, `normalize.ts`, `sources.ts`)
- ✅ Independent Supabase client (service role)
- ✅ Independent QStash client
- ✅ Worker endpoint (`/api/crawler/worker`)
- ✅ Cron endpoints (`/api/crawler/cron/daily`, `/weekly`, `/monthly`)
- ✅ Health check endpoint (`/api/health`)
- ✅ Vercel cron configuration (`vercel.json`)
- ✅ Build passes successfully
- ✅ Ready for deployment

## 🚀 Deployment Steps

### 1. Deploy Crawler Service to Vercel

```bash
cd Docs-Bridge-Crawler

# Initialize git if not already done
git init
git add .
git commit -m "Initial crawler service"

# Push to GitHub/GitLab
git remote add origin YOUR_CRAWLER_REPO_URL
git push -u origin main
```

Then in Vercel:
1. Import the repository
2. Configure environment variables (see `.env.example`)
3. Deploy

### 2. Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```env
# Supabase (same as main app)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# QStash
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=xxx
QSTASH_NEXT_SIGNING_KEY=xxx

# Cron Secret (generate with: openssl rand -hex 32)
CRON_SECRET=your_random_secret_here

# Main App URL (for processing callback)
DOCSBRIDGE_APP_URL=https://your-main-app.vercel.app

# System User ID
SYSTEM_USER_ID=00000000-0000-0000-0000-000000000000
```

### 3. Verify Deployment

```bash
# Check health
curl https://your-crawler-service.vercel.app/api/health

# Should return:
# {
#   "status": "healthy",
#   "service": "docs-bridge-crawler",
#   "sources": { "total": 25, ... }
# }
```

### 4. Test Cron Manually

```bash
curl -X GET https://your-crawler-service.vercel.app/api/crawler/cron/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 🗑️ Cleanup Main App (Optional)

Once the crawler service is deployed and working, you can remove crawler-related code from the main app.

### Files to Remove from Main App

```bash
# Crawler library files
rm -rf lib/crawler/

# Crawler API routes
rm -rf app/api/crawler/

# QStash client (if only used by crawler)
rm -rf lib/qstash/
```

### Dependencies to Remove from Main App

Edit `package.json` and remove (if only used by crawler):

```json
{
  "dependencies": {
    "@upstash/qstash": "^2.3.0",  // Remove if only crawler uses it
    "cheerio": "^1.0.0-rc.12",     // Remove
    "pdf-parse": "^1.1.1"          // Remove
  }
}
```

Then run:
```bash
npm install
```

### Update Main App's Document Processing

The main app's `/api/kb/documents/[id]/process` endpoint already supports `system_call: true` for crawler authentication, so no changes needed there.

## 🔄 Architecture After Migration

```
┌─────────────────────────────────────────────────────────────┐
│                     Vercel Cron Jobs                        │
│  (Daily 2AM, Weekly Sun 3AM, Monthly 1st 4AM)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Docs-Bridge-Crawler Service                    │
│                  (Separate Vercel App)                      │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Cron Routes  │───▶│ QStash Queue │───▶│    Worker    │ │
│  └──────────────┘    └──────────────┘    └──────┬───────┘ │
│                                                   │         │
│                                                   ▼         │
│                                          ┌────────────────┐ │
│                                          │ Crawl Websites │ │
│                                          └────────┬───────┘ │
└──────────────────────────────────────────────────┼─────────┘
                                                    │
                                                    ▼
                                          ┌─────────────────┐
                                          │    Supabase     │
                                          │  kb_documents   │
                                          └────────┬────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  DocsBridge Main App                        │
│                  (Separate Vercel App)                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/kb/documents/[id]/process                      │  │
│  │  (Receives callback from crawler)                    │  │
│  │  - Chunks document                                   │  │
│  │  - Generates dual embeddings (384 + 1024)           │  │
│  │  - Stores in document_chunks                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/chat/query                                     │  │
│  │  - Hybrid retrieval (384-dim coarse + 1024 rerank)  │  │
│  │  - RAG with LLM                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Key Differences from Monolith

### Before (Monolith)
- Crawler routes in main app
- All dependencies in one `package.json`
- Single deployment
- Crawler and app share same runtime

### After (Microservices)
- Crawler is separate Vercel app
- Independent dependencies
- Two separate deployments
- Crawler calls main app via HTTP for processing
- Better separation of concerns
- Can scale independently

## 📊 Data Flow

1. **Vercel Cron** triggers `/api/crawler/cron/daily` (or weekly/monthly)
2. **Cron Route** queues jobs to QStash for each source
3. **QStash** delivers jobs to `/api/crawler/worker` with retries
4. **Worker** crawls website and saves to Supabase `kb_documents`
5. **Worker** calls main app's `/api/kb/documents/[id]/process`
6. **Main App** chunks document and generates embeddings
7. **Main App** stores chunks in `document_chunks` table
8. **Users** query via main app's `/api/chat/query` endpoint

## 🧪 Testing the Complete Flow

### 1. Trigger a Manual Crawl

```bash
# Trigger daily cron
curl -X GET https://your-crawler-service.vercel.app/api/crawler/cron/daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Response:
# {
#   "success": true,
#   "queued": 5,
#   "failed": 0,
#   "jobs": [...]
# }
```

### 2. Check QStash Queue

1. Login to Upstash Console
2. Go to QStash → Messages
3. You should see queued jobs

### 3. Monitor Worker Logs

In Vercel Dashboard → Crawler Service → Functions → Logs:

```
[Crawler Worker] Processing crawl job...
[Crawler Worker] Source ID: moh-subsidy-guide
[Crawler Worker] Crawling HTML: https://...
[Crawler Worker] ✅ Crawled: MOH Subsidy Guidelines
[Crawler Worker] Quality score: 85/100
[Crawler Worker] ✅ Saved document: abc-123
[Crawler Worker] Triggering document processing on main app...
[Crawler Worker] ✅ Document processing completed
[Crawler Worker] Created 12 chunks with embeddings
```

### 4. Verify in Supabase

```sql
-- Check documents
SELECT id, title, document_type, trust_level, created_at
FROM kb_documents
WHERE document_type = 'gov_crawled'
ORDER BY created_at DESC
LIMIT 10;

-- Check chunks
SELECT dc.id, dc.chunk_index, dc.content_preview, d.title
FROM document_chunks dc
JOIN kb_documents d ON dc.document_id = d.id
WHERE d.document_type = 'gov_crawled'
ORDER BY dc.created_at DESC
LIMIT 10;
```

### 5. Test RAG Query

In main app:

```bash
curl -X POST https://your-main-app.vercel.app/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How to apply for healthcare subsidy?",
    "conversation_id": "test-123"
  }'
```

## 🐛 Troubleshooting

### Issue: Cron not triggering

**Check:**
- Vercel Dashboard → Cron Jobs shows the schedules
- Project is on a plan that supports cron (Pro or higher)

**Fix:**
```bash
# Redeploy to refresh cron configuration
git commit --allow-empty -m "Refresh cron"
git push
```

### Issue: Worker receives jobs but fails

**Check:**
- Crawler service logs in Vercel
- Environment variables are set correctly
- Supabase connection works

**Fix:**
```bash
# Test health endpoint
curl https://your-crawler-service.vercel.app/api/health

# Check if it can connect to Supabase
```

### Issue: Documents saved but not processed

**Check:**
- `DOCSBRIDGE_APP_URL` is set correctly
- Main app's process endpoint is accessible
- Main app accepts `system_call: true`

**Fix:**
```bash
# Test main app's process endpoint directly
curl -X POST https://your-main-app.vercel.app/api/kb/documents/TEST_ID/process \
  -H "Content-Type: application/json" \
  -d '{"system_call": true, "force_reprocess": true}'
```

### Issue: QStash signature verification fails

**Check:**
- `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are correct
- Keys are from Upstash Console → QStash → Signing Keys

**Fix:**
1. Copy latest keys from Upstash
2. Update Vercel environment variables
3. Redeploy

## 📈 Monitoring

### Key Metrics to Track

1. **Crawl Success Rate**
   - Check QStash dashboard for failed messages
   - Monitor worker logs for errors

2. **Document Quality**
   - Check `quality_score` in `kb_documents`
   - Should be > 70 for most documents

3. **Processing Time**
   - Worker should complete in < 60 seconds per document
   - Check Vercel function execution time

4. **Storage Growth**
   - Monitor Supabase database size
   - Track number of documents and chunks

### Alerts to Set Up

1. **Vercel Deployment Failures**
   - Vercel → Project Settings → Notifications

2. **QStash Failed Messages**
   - Upstash → QStash → Alerts

3. **Supabase Storage**
   - Supabase → Project Settings → Usage Alerts

## 🎉 Success Criteria

Your migration is complete when:

- ✅ Crawler service deploys successfully
- ✅ Health check returns 200
- ✅ Cron jobs appear in Vercel Dashboard
- ✅ Manual cron trigger queues jobs
- ✅ Worker processes jobs and saves documents
- ✅ Main app receives callbacks and processes documents
- ✅ Chunks appear in `document_chunks` table
- ✅ RAG queries return relevant results
- ✅ Main app no longer has crawler code (optional cleanup)

## 📚 Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- [README.md](./README.md) - Service overview
- Main app's `DUAL_EMBEDDING_SUMMARY.md` - Embedding architecture
- Main app's `EMBEDDING_IMPLEMENTATION_STATUS.md` - Implementation details

## 🔄 Rollback Plan

If something goes wrong:

1. **Keep main app's crawler code** until crawler service is proven stable
2. **Run both in parallel** for a transition period
3. **Compare results** to ensure crawler service works correctly
4. **Only remove main app's crawler code** after 1-2 weeks of stable operation

## 💡 Future Improvements

- Add crawler service dashboard
- Implement crawler job scheduling UI
- Add webhook notifications for failed crawls
- Implement incremental crawling (only changed content)
- Add support for more document types (Word, Excel, etc.)
- Implement crawler rate limiting per domain
- Add crawler job priority queue
