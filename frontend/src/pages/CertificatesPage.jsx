import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api, API_BASE } from '../config/api';
import Panel from '../components/Panel';

function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    api.get('/api/certificates/').then(res => setCertificates(res.data)).catch(console.error);
  }, []);

  const filteredCerts = certificates.filter(cert => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return cert.state === 'conformant' || cert.state === 'active' || cert.state === 'issued';
    return cert.state === statusFilter;
  });

  const counts = {
    all: certificates.length,
    active: certificates.filter(c => c.state === 'conformant' || c.state === 'active' || c.state === 'issued').length,
    suspended: certificates.filter(c => c.state === 'suspended').length,
    revoked: certificates.filter(c => c.state === 'revoked').length
  };

  const filterTabs = [
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'revoked', label: 'Revoked' },
    { key: 'all', label: 'All Records' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a896d6', marginBottom: '8px'}}>Records</p>
        <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 200, margin: 0}}>Certificates</h1>
        <p style={{color: 'rgba(255,255,255,.78)', marginTop: '8px'}}>Issued ODDC conformance determinations</p>
      </div>

      {/* Filter Tabs */}
      <div style={{display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', border: `1px solid ${'rgba(255,255,255,.07)'}`}}>
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            style={{
              flex: 1,
              padding: '8px 16px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "Consolas, 'IBM Plex Mono', monospace",
              fontSize: '10px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              background: statusFilter === tab.key ? '#5B4B8A' : 'transparent',
              color: statusFilter === tab.key ? '#fff' : 'rgba(255,255,255,.50)'
            }}
          >
            {tab.label} {counts[tab.key] > 0 ? `(${counts[tab.key]})` : ''}
          </button>
        ))}
      </div>

      <Panel>
        <div style={{overflowX: "auto", WebkitOverflowScrolling: "touch"}}><table className="w-full" style={{minWidth: "600px"}}>
          <thead>
            <tr style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`}}>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Certificate #</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>System</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Organization</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Status</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Expires</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCerts.map((cert) => (
              <tr key={cert.id} style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`}}>
                <td className="px-4 py-4" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '12px', color: '#a896d6'}}>{cert.certificate_number}</td>
                <td className="px-4 py-4" style={{color: 'rgba(255,255,255,.94)'}}>{cert.system_name}</td>
                <td className="px-4 py-4" style={{color: 'rgba(255,255,255,.78)'}}>{cert.organization_name}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1" style={{
                    background: cert.state === 'conformant' ? 'rgba(92,214,133,0.04)' : cert.state === 'suspended' ? 'rgba(214,160,92,0.04)' : 'rgba(214,92,92,0.04)',
                    color: cert.state === 'conformant' ? '#5CD685' : cert.state === 'suspended' ? '#D6A05C' : '#D65C5C',
                    fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}>
                    {cert.state}
                  </span>
                </td>
                <td className="px-4 py-4" style={{color: 'rgba(255,255,255,.50)', fontSize: '14px'}}>{cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-4">
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    {cert.state !== 'revoked' && cert.state !== 'suspended' ? (
                      <a 
                        href={`${API_BASE}/api/certificates/${cert.certificate_number}/pdf`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="px-3 py-1 transition-colors no-underline btn"
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,.50)', letterSpacing: '1px', textTransform: 'uppercase'}}>
                        {cert.state === 'revoked' ? 'Revoked' : 'Suspended'}
                      </span>
                    )}
                    <Link to={`/verify?cert=${cert.certificate_number}`} className="px-2 py-1 no-underline btn">Verify</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {filteredCerts.length === 0 && (
          <div className="text-center py-12" style={{color: 'rgba(255,255,255,.50)'}}>
            {certificates.length === 0 ? 'No certificates issued' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}certificates`}
          </div>
        )}
      </Panel>
    </div>
  );
}

// Licensees

export default CertificatesPage;

