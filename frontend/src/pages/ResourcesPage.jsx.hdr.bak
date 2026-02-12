import React, { useState, useEffect } from 'react';
import { Download, BookOpen } from 'lucide-react';
import { api } from '../config/api';
import { useAuth } from '../context/AuthContext';

function ResourcesPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/documents/')
      .then(res => { setDocuments(Array.isArray(res.data) ? res.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDownload = async (docId, title) => {
    try {
      const response = await api.get('/api/documents/' + docId + '/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = title.replace(/\s+/g, '_') + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <p style={{
          fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px',
          letterSpacing: '2px', textTransform: 'uppercase',
          color: '#a896d6', marginBottom: '8px'
        }}>RESOURCES</p>
        <h1 style={{
          fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(20px, 4vw, 28px)',
          fontWeight: 200, color: 'rgba(255,255,255,.94)', margin: 0
        }}>Documents & Guides</h1>
        <p style={{ color: 'rgba(255,255,255,.50)', marginTop: '8px', fontSize: '14px' }}>
          Reference materials for the ODDC certification process.
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,.50)', fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px' }}>
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          padding: 'clamp(16px, 4vw, 40px)', textAlign: 'center', border: '1px solid ' + 'rgba(255,255,255,.07)', background: '#2a2f3d',
          color: 'rgba(255,255,255,.50)'
        }}>
          No documents available.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {documents.map(doc => (
            <div key={doc.id} style={{
              padding: '24px', border: '1px solid ' + 'rgba(255,255,255,.07)', background: '#2a2f3d',
              display: 'flex', alignItems: 'center', gap: '20px'
            }}>
              <div style={{
                width: '48px', height: '48px', background: '#5B4B8A' + '22',
                border: '1px solid ' + '#5B4B8A' + '44',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <BookOpen fill="currentColor" fillOpacity={0.15} strokeWidth={1.8} style={{ width: '22px', height: '22px', color: '#a896d6' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.94)', fontSize: '15px', marginBottom: '4px' }}>
                  {doc.title}
                </div>
                <div style={{ color: 'rgba(255,255,255,.50)', fontSize: '13px', lineHeight: '1.4' }}>
                  {doc.description}
                </div>
                <div style={{
                  fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px',
                  color: 'rgba(255,255,255,.50)', marginTop: '6px',
                  letterSpacing: '1px', textTransform: 'uppercase'
                }}>
                  {'PDF • v' + doc.version}
                </div>
              </div>
              <button
                onClick={() => handleDownload(doc.id, doc.title)}
                style={{
                  padding: '10px 20px', background: '#5B4B8A',
                  border: '1px solid ' + '#a896d6',
                  color: 'rgba(255,255,255,.94)', fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                  fontSize: '11px', letterSpacing: '1px',
                  textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0
                }}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {user && user.role === 'admin' && (
        <div style={{
          marginTop: '40px', padding: '20px', border: '1px dashed ' + 'rgba(255,255,255,.07)',
          color: 'rgba(255,255,255,.50)', fontSize: '12px',
          fontFamily: "Consolas, 'IBM Plex Mono', monospace"
        }}>
          ADMIN: To add documents, place PDFs in backend/static/documents/ and register them in documents.py
        </div>
      )}
    </div>
  );
}


export default ResourcesPage;

