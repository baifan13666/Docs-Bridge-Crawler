'use client';

import { useEffect, useState } from 'react';

interface Document {
  id: string;
  title: string;
  document_type: string;
  trust_level: number;
  created_at: string;
  chunk_count?: number;
}

interface Stats {
  total_documents: number;
  total_chunks: number;
  avg_quality_score: number;
  documents_today: number;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // 每 10 秒刷新一次
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setDocuments(data.documents || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#0f172a',
        color: '#e2e8f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '4px solid #334155',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Loading dashboard...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      padding: '24px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#f1f5f9'
          }}>
            🤖 Crawler Dashboard
          </h1>
          <p style={{ color: '#94a3b8' }}>
            Real-time monitoring of government document crawling
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#7f1d1d',
            border: '1px solid #991b1b',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <p style={{ color: '#fca5a5' }}>❌ Error: {error}</p>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
            marginBottom: '32px'
          }}>
            <StatCard 
              title="Total Documents" 
              value={stats.total_documents}
              icon="📄"
              color="#3b82f6"
            />
            <StatCard 
              title="Total Chunks" 
              value={stats.total_chunks}
              icon="🧩"
              color="#8b5cf6"
            />
            <StatCard 
              title="Avg Quality Score" 
              value={`${stats.avg_quality_score.toFixed(1)}/100`}
              icon="⭐"
              color="#10b981"
            />
            <StatCard 
              title="Documents Today" 
              value={stats.documents_today}
              icon="📅"
              color="#f59e0b"
            />
          </div>
        )}

        {/* Recent Documents */}
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1f5f9' }}>
              Recent Documents
            </h2>
            <button
              onClick={fetchData}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🔄 Refresh
            </button>
          </div>

          {documents.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
              No documents found. Start crawling to see results here.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #334155' }}>
                    <th style={tableHeaderStyle}>Title</th>
                    <th style={tableHeaderStyle}>Trust Level</th>
                    <th style={tableHeaderStyle}>Chunks</th>
                    <th style={tableHeaderStyle}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, index) => (
                    <tr 
                      key={doc.id}
                      style={{ 
                        borderBottom: '1px solid #334155',
                        backgroundColor: index % 2 === 0 ? '#1e293b' : '#0f172a'
                      }}
                    >
                      <td style={tableCellStyle}>
                        <div style={{ 
                          maxWidth: '400px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {doc.title}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <TrustBadge level={doc.trust_level} />
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}>
                          {doc.chunk_count || 0}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        {new Date(doc.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: '32px', 
          textAlign: 'center', 
          color: '#64748b',
          fontSize: '14px'
        }}>
          <p>Auto-refreshes every 10 seconds</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { 
  title: string; 
  value: string | number; 
  icon: string;
  color: string;
}) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>
          {title}
        </span>
        <span style={{ fontSize: '24px' }}>{icon}</span>
      </div>
      <div style={{ 
        fontSize: '2rem', 
        fontWeight: 'bold', 
        color: '#f1f5f9' 
      }}>
        {value}
      </div>
    </div>
  );
}

function TrustBadge({ level }: { level: number }) {
  const colors: Record<number, { bg: string; text: string }> = {
    5: { bg: '#065f46', text: '#6ee7b7' },
    4: { bg: '#1e40af', text: '#93c5fd' },
    3: { bg: '#7c2d12', text: '#fdba74' },
    2: { bg: '#991b1b', text: '#fca5a5' },
    1: { bg: '#7f1d1d', text: '#fca5a5' },
  };

  const color = colors[level] || colors[3];

  return (
    <span style={{
      backgroundColor: color.bg,
      color: color.text,
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600'
    }}>
      Level {level}
    </span>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  color: '#94a3b8',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tableCellStyle: React.CSSProperties = {
  padding: '16px',
  color: '#e2e8f0'
};
