import React, { useState, useEffect } from 'react';
import { Download, BookOpen } from 'lucide-react';
import { api } from '../config/api';
import { styles } from '../config/styles';
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
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '32px' }}>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
          letterSpacing: '2px', textTransform: 'uppercase',
          color: styles.purpleBright, marginBottom: '8px'
        }}>RESOURCES</p>
        <h1 style={{
          fontFamily: "'Source Serif 4', serif", fontSize: '28px',
          fontWeight: 200, color: styles.textPrimary, margin: 0
        }}>Documents & Guides</h1>
        <p style={{ color: styles.textTertiary, marginTop: '8px', fontSize: '14px' }}>
          Reference materials for the ODDC certification process.
        </p>
      </div>

      {loading ? (
        <div style={{ color: styles.textTertiary, fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div style={{
          padding: '40px', textAlign: 'center', borderRadius: '12px',
          border: '1px solid ' + styles.borderGlass, background: styles.bgCard,
          color: styles.textTertiary
        }}>
          No documents available.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {documents.map(doc => (
            <div key={doc.id} style={{
              padding: '24px', borderRadius: '12px',
              border: '1px solid ' + styles.borderGlass, background: styles.bgCard,
              display: 'flex', alignItems: 'center', gap: '20px'
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '10px',
                background: styles.purplePrimary + '22',
                border: '1px solid ' + styles.purplePrimary + '44',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <BookOpen style={{ width: '22px', height: '22px', color: styles.purpleBright }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: styles.textPrimary, fontSize: '15px', marginBottom: '4px' }}>
                  {doc.title}
                </div>
                <div style={{ color: styles.textTertiary, fontSize: '13px', lineHeight: '1.4' }}>
                  {doc.description}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                  color: styles.textTertiary, marginTop: '6px',
                  letterSpacing: '1px', textTransform: 'uppercase'
                }}>
                  {'PDF • v' + doc.version}
                </div>
              </div>
              <button
                onClick={() => handleDownload(doc.id, doc.title)}
                style={{
                  padding: '10px 20px', borderRadius: '8px',
                  background: styles.purplePrimary,
                  border: '1px solid ' + styles.purpleBright,
                  color: '#fff', fontFamily: "'IBM Plex Mono', monospace",
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
          marginTop: '40px', padding: '20px', borderRadius: '10px',
          border: '1px dashed ' + styles.borderGlass,
          color: styles.textTertiary, fontSize: '12px',
          fontFamily: "'IBM Plex Mono', monospace"
        }}>
          ADMIN: To add documents, place PDFs in backend/static/documents/ and register them in documents.py
        </div>
      )}
    </div>
  );
}


export default ResourcesPage;

