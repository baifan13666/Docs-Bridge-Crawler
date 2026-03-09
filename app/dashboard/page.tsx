'use client';

import { useEffect, useState } from 'react';

interface Chunk {
  id: string;
  chunk_text: string;
  chunk_index: number;
  token_count: number;
  has_small_embedding: boolean;
  has_large_embedding: boolean;
}

interface CrawlLog {
  id: string;
  source_id: string;
  source_name: string;
  source_url: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface Document {
  id: string;
  title: string;
  source_url: string;
  document_type: string;
  trust_level: number;
  language: string;
  created_at: string;
  updated_at: string;
  chunk_count?: number;
  chunks?: Chunk[];
}

interface Stats {
  total_documents: number;
  total_chunks: number;
  avg_quality_score: number;
  documents_today: number;
  chunks_with_small: number;
  chunks_with_large: number;
  embedding_completion_rate: number;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'crawls'>('documents');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setDocuments(data.documents || []);
      setCrawlLogs(data.crawl_logs || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function loadDocumentChunks(docId: string) {
    try {
      const response = await fetch(`/api/dashboard/document/${docId}`);
      if (!response.ok) throw new Error('Failed to fetch document details');
      const data = await response.json();
      setSelectedDoc(data.document);
    } catch (err) {
      console.error('Error loading document chunks:', err);
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
              title="Avg Quality" 
              value={`${stats.avg_quality_score.toFixed(1)}/100`}
              icon="⭐"
              color="#10b981"
            />
            <StatCard 
              title="Today" 
              value={stats.documents_today}
              icon="📅"
              color="#f59e0b"
            />
            <StatCard 
              title="384-dim Ready" 
              value={`${stats.chunks_with_small}/${stats.total_chunks}`}
              icon="🔹"
              color="#06b6d4"
            />
            <StatCard 
              title="1024-dim Ready" 
              value={`${stats.chunks_with_large}/${stats.total_chunks}`}
              icon="🔸"
              color="#ec4899"
            />
          </div>
        )}

        {/* Tabs */}
        <div style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('documents')}
            style={{
              backgroundColor: activeTab === 'documents' ? '#3b82f6' : '#1e293b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📄 Documents
          </button>
          <button
            onClick={() => setActiveTab('crawls')}
            style={{
              backgroundColor: activeTab === 'crawls' ? '#3b82f6' : '#1e293b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🕷️ Crawl History
          </button>
          <button
            onClick={fetchData}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              marginLeft: 'auto'
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* Content */}
        {activeTab === 'documents' ? (
          <DocumentsTab 
            documents={documents} 
            selectedDoc={selectedDoc}
            onSelectDoc={loadDocumentChunks}
            onCloseDoc={() => setSelectedDoc(null)}
          />
        ) : (
          <CrawlLogsTab crawlLogs={crawlLogs} />
        )}

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


function DocumentsTab({ 
  documents, 
  selectedDoc,
  onSelectDoc,
  onCloseDoc
}: { 
  documents: Document[];
  selectedDoc: Document | null;
  onSelectDoc: (id: string) => void;
  onCloseDoc: () => void;
}) {
  if (selectedDoc) {
    return <DocumentDetail doc={selectedDoc} onClose={onCloseDoc} />;
  }

  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '20px' }}>
        Recent Documents
      </h2>

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
                <th style={tableHeaderStyle}>Source URL</th>
                <th style={tableHeaderStyle}>Quality</th>
                <th style={tableHeaderStyle}>Words</th>
                <th style={tableHeaderStyle}>Chunks</th>
                <th style={tableHeaderStyle}>Created</th>
                <th style={tableHeaderStyle}>Actions</th>
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
                      maxWidth: '300px', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {doc.title}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <a 
                      href={doc.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#60a5fa', 
                        textDecoration: 'none',
                        fontSize: '14px'
                      }}
                    >
                      🔗 Link
                    </a>
                  </td>
                  <td style={tableCellStyle}>
                    <QualityBadge score={doc.quality_score} />
                  </td>
                  <td style={tableCellStyle}>
                    {doc.word_count?.toLocaleString() || 0}
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
                    <div style={{ fontSize: '14px' }}>
                      {new Date(doc.created_at).toLocaleDateString()}
                      <br />
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                        {new Date(doc.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <button
                      onClick={() => onSelectDoc(doc.id)}
                      style={{
                        backgroundColor: '#8b5cf6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      View Chunks
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DocumentDetail({ doc, onClose }: { doc: Document; onClose: () => void }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1f5f9' }}>
          Document Details
        </h2>
        <button
          onClick={onClose}
          style={{
            backgroundColor: '#64748b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ← Back
        </button>
      </div>

      {/* Document Info */}
      <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#0f172a', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#f1f5f9' }}>{doc.title}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Source: </span>
            <a href={doc.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
              {doc.source_url}
            </a>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Quality: </span>
            <QualityBadge score={doc.quality_score} />
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Words: </span>
            <span style={{ color: '#e2e8f0' }}>{doc.word_count?.toLocaleString()}</span>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Trust Level: </span>
            <TrustBadge level={doc.trust_level} />
          </div>
        </div>
      </div>

      {/* Chunks */}
      <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#f1f5f9' }}>
        Chunks ({doc.chunks?.length || 0})
      </h3>
      
      {!doc.chunks || doc.chunks.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
          No chunks found for this document.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {doc.chunks.map((chunk) => (
            <div 
              key={chunk.id}
              style={{
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #334155'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                  Chunk #{chunk.chunk_index + 1} • {chunk.token_count} tokens
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <EmbeddingBadge has={chunk.has_small_embedding} label="384d" />
                  <EmbeddingBadge has={chunk.has_large_embedding} label="1024d" />
                </div>
              </div>
              <p style={{ 
                color: '#e2e8f0', 
                fontSize: '14px', 
                lineHeight: '1.6',
                maxHeight: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {chunk.chunk_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrawlLogsTab({ crawlLogs }: { crawlLogs: CrawlLog[] }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '20px' }}>
        Crawl History
      </h2>

      {crawlLogs.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
          No crawl logs found.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #334155' }}>
                <th style={tableHeaderStyle}>Source</th>
                <th style={tableHeaderStyle}>URL</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Started</th>
                <th style={tableHeaderStyle}>Duration</th>
                <th style={tableHeaderStyle}>Error</th>
              </tr>
            </thead>
            <tbody>
              {crawlLogs.map((log, index) => {
                const duration = log.completed_at 
                  ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                  : null;
                
                return (
                  <tr 
                    key={log.id}
                    style={{ 
                      borderBottom: '1px solid #334155',
                      backgroundColor: index % 2 === 0 ? '#1e293b' : '#0f172a'
                    }}
                  >
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: '500' }}>{log.source_name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{log.source_id}</div>
                    </td>
                    <td style={tableCellStyle}>
                      <a 
                        href={log.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#60a5fa', 
                          textDecoration: 'none',
                          fontSize: '14px'
                        }}
                      >
                        🔗 Link
                      </a>
                    </td>
                    <td style={tableCellStyle}>
                      <StatusBadge status={log.status} />
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ fontSize: '14px' }}>
                        {new Date(log.started_at).toLocaleDateString()}
                        <br />
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                          {new Date(log.started_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      {duration !== null ? `${duration}s` : '-'}
                    </td>
                    <td style={tableCellStyle}>
                      {log.error_message ? (
                        <span style={{ color: '#fca5a5', fontSize: '12px' }}>
                          {log.error_message.substring(0, 50)}...
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
        fontSize: '1.5rem', 
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

function QualityBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return { bg: '#065f46', text: '#6ee7b7' };
    if (score >= 60) return { bg: '#1e40af', text: '#93c5fd' };
    if (score >= 40) return { bg: '#7c2d12', text: '#fdba74' };
    return { bg: '#991b1b', text: '#fca5a5' };
  };

  const color = getColor();

  return (
    <span style={{
      backgroundColor: color.bg,
      color: color.text,
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600'
    }}>
      {score}/100
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    success: { bg: '#065f46', text: '#6ee7b7' },
    failed: { bg: '#991b1b', text: '#fca5a5' },
    running: { bg: '#1e40af', text: '#93c5fd' },
  };

  const color = colors[status] || { bg: '#64748b', text: '#e2e8f0' };

  return (
    <span style={{
      backgroundColor: color.bg,
      color: color.text,
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600',
      textTransform: 'capitalize'
    }}>
      {status}
    </span>
  );
}

function EmbeddingBadge({ has, label }: { has: boolean; label: string }) {
  return (
    <span style={{
      backgroundColor: has ? '#065f46' : '#64748b',
      color: has ? '#6ee7b7' : '#cbd5e1',
      padding: '2px 8px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: '600'
    }}>
      {label} {has ? '✓' : '○'}
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
