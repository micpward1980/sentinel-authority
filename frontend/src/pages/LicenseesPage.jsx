import React, { useState, useEffect } from 'react';
import { api } from '../config/api';
import Panel from '../components/Panel';

function LicenseesPage() {
  const [loading, setLoading] = useState(true);
  const [licensees, setLicensees] = useState([]);

  useEffect(() => {
    api.get('/api/licensees/').then(res => setLicensees(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{padding:"40px 0",textAlign:"center"}}><div style={{fontFamily:"Consolas,monospace",fontSize:11,color:"rgba(255,255,255,.3)"}}>Loading licensees...</div></div>;
  return (
    <div className="space-y-6">
      <div>
        <p style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '4px', textTransform: 'uppercase', color: '#a896d6', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px'}}><span style={{width:'24px',height:'1px',background:'#a896d6'}}></span>Partners</p>
        <h1 style={{fontFamily: "Georgia, 'Source Serif 4', serif", fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 200, letterSpacing: '-0.02em', margin: 0}}>Licensed Implementers</h1>
        <p style={{color: 'rgba(255,255,255,.78)', marginTop: '8px'}}>Authorized ENVELO integrators</p>
      </div>

      <Panel>
        <div style={{overflowX: "auto", WebkitOverflowScrolling: "touch"}}><table className="w-full" style={{minWidth: "500px"}}>
          <thead>
            <tr style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`}}>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Company</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Contact</th>
              <th className="px-4 py-3 text-left" style={{fontFamily: "Consolas, 'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', fontWeight: 400}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {licensees.map((lic) => (
              <tr key={lic.id} style={{borderBottom: `1px solid ${'rgba(255,255,255,.07)'}`}}>
                <td className="px-4 py-4" style={{color: 'rgba(255,255,255,.94)'}}>{lic.company_name}</td>
                <td className="px-4 py-4" style={{color: 'rgba(255,255,255,.78)'}}>{lic.contact_email}</td>
                <td className="px-4 py-4">
                  <span className="px-2 py-1" style={{
                    background: lic.status === 'active' ? 'rgba(92,214,133,0.04)' : 'rgba(214,160,92,0.04)',
                    color: lic.status === 'active' ? '#5CD685' : '#D6A05C',
                    fontFamily: "Consolas, 'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}>
                    {lic.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {licensees.length === 0 && (
          <div className="text-center py-12" style={{color: 'rgba(255,255,255,.50)'}}>No licensees yet</div>
        )}
      </Panel>
    </div>
  );
}

// Verify Page (Public)

export default LicenseesPage;

