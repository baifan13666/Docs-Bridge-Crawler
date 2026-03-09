export default function Home() {
  return (
    <main style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#0f172a',
      color: '#e2e8f0'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '800px', padding: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#f1f5f9' }}>
          🤖 DocsBridge Crawler Service
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '1.1rem' }}>
          Government document crawler with dual embedding (384-dim + 1024-dim)
        </p>
        
        {/* Dashboard Link */}
        <a 
          href="/dashboard"
          style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 32px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '1.1rem',
            fontWeight: '600',
            marginBottom: '3rem',
            boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
          }}
        >
          📊 View Dashboard
        </a>
        
        <div style={{ 
          backgroundColor: '#1e293b', 
          padding: '2rem', 
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          textAlign: 'left',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#f1f5f9' }}>
            API Endpoints
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, color: '#94a3b8' }}>
            <li style={{ marginBottom: '1rem' }}>
              <code style={{ 
                backgroundColor: '#0f172a', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '6px',
                fontSize: '0.95rem',
                color: '#60a5fa'
              }}>
                GET /api/health
              </code>
              <span style={{ marginLeft: '1rem' }}>Health check</span>
            </li>
            <li style={{ marginBottom: '1rem' }}>
              <code style={{ 
                backgroundColor: '#0f172a', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '6px',
                fontSize: '0.95rem',
                color: '#60a5fa'
              }}>
                GET /api/dashboard/stats
              </code>
              <span style={{ marginLeft: '1rem' }}>Dashboard statistics</span>
            </li>
            <li style={{ marginBottom: '1rem' }}>
              <code style={{ 
                backgroundColor: '#0f172a', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '6px',
                fontSize: '0.95rem',
                color: '#60a5fa'
              }}>
                POST /api/crawler/worker
              </code>
              <span style={{ marginLeft: '1rem' }}>QStash worker</span>
            </li>
            <li style={{ marginBottom: '1rem' }}>
              <code style={{ 
                backgroundColor: '#0f172a', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '6px',
                fontSize: '0.95rem',
                color: '#60a5fa'
              }}>
                GET /api/crawler/cron/daily
              </code>
              <span style={{ marginLeft: '1rem' }}>Daily cron</span>
            </li>
            <li style={{ marginBottom: '1rem' }}>
              <code style={{ 
                backgroundColor: '#0f172a', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '6px',
                fontSize: '0.95rem',
                color: '#60a5fa'
              }}>
                GET /api/crawler/cron/weekly
              </code>
              <span style={{ marginLeft: '1rem' }}>Weekly cron</span>
            </li>
            <li>
              <code style={{ 
                backgroundColor: '#0f172a', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '6px',
                fontSize: '0.95rem',
                color: '#60a5fa'
              }}>
                GET /api/crawler/cron/monthly
              </code>
              <span style={{ marginLeft: '1rem' }}>Monthly cron</span>
            </li>
          </ul>
        </div>

        <div style={{
          backgroundColor: '#1e293b',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#f1f5f9' }}>
            🚀 Features
          </h3>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            color: '#94a3b8',
            textAlign: 'left'
          }}>
            <li style={{ marginBottom: '0.5rem' }}>✅ Crawls 25 government sources</li>
            <li style={{ marginBottom: '0.5rem' }}>✅ Dual embedding (e5-small 384 + e5-large 1024)</li>
            <li style={{ marginBottom: '0.5rem' }}>✅ Automatic chunking (500-800 tokens)</li>
            <li style={{ marginBottom: '0.5rem' }}>✅ Quality scoring (0-100)</li>
            <li style={{ marginBottom: '0.5rem' }}>✅ Real-time dashboard</li>
            <li>✅ Scheduled cron jobs (daily/weekly/monthly)</li>
          </ul>
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#64748b' }}>
          Service Status: <span style={{ color: '#10b981', fontWeight: 'bold' }}>Running</span>
        </p>
      </div>
    </main>
  );
}
