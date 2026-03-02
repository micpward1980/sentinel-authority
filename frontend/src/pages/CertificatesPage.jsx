import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { api, API_BASE } from '../config/api';
import { styles } from '../config/styles';
import Badge from '../components/Badge';
import Pagination from '../components/Pagination';
import SortHeader from '../components/SortHeader';

const LIMIT = 25;

function certVariant(state) {
  if (state === 'conformant' || state === 'active' || state === 'issued') return 'green';
  if (state === 'suspended') return 'amber';
  if (state === 'revoked') return 'red';
  if (state === 'pending') return 'amber';
  return 'dim';
}

function isActiveState(state) {
  return state === 'conformant' || state === 'active' || state === 'issued';
}
function isPending(state) {
  return state === 'pending';
}

const TABS = [
  { key: 'conformant', label: 'Conformant' },
  { key: 'pending', label: 'Pending' },
  { key: 'nonconformant', label: 'Non-Conformant' },
  { key: 'all', label: 'All' },
];

function CertificatesPage() {
  const navigate = useNavigate();
  const [certs, setCerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState('issued_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stateFilter, setStateFilter] = useState('conformant');
  const [counts, setCounts] = useState({ all: 0, conformant: 0, pending: 0, nonconformant: 0 });

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: LIMIT, offset, sort_by: sortBy, sort_order: sortOrder,
      });
      if (search) params.append('search', search);
      if (stateFilter === 'conformant') {
          params.append('state', 'conformant');
        } else if (stateFilter === 'pending') {
          params.append('state', 'pending');
        } else if (stateFilter === 'nonconformant') {
          // handled client-side
        } else if (stateFilter !== 'all') {
          params.append('state', stateFilter);
        }
      const res = await api.get('/api/v1/certificates/list?' + params.toString());
      setCerts(res.data.certificates || res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.counts) setCounts(res.data.counts);
    } catch {
      // Fallback to old endpoint
      try {
        const res = await api.get('/api/certificates/');
        const raw = res.data || [];
        setCounts({
          all: raw.length,
          conformant: raw.filter(c => isActiveState(c.state)).length,
          pending: raw.filter(c => c.state === 'pending').length,
          nonconformant: raw.filter(c => c.state === 'suspended' || c.state === 'revoked' || c.state === 'expired').length,
        });
        let all = [...raw];
        // Client-side filter
        if (stateFilter === 'conformant') all = all.filter(c => isActiveState(c.state));
        else if (stateFilter === 'pending') all = all.filter(c => c.state === 'pending');
        else if (stateFilter === 'nonconformant') all = all.filter(c => c.state === 'suspended' || c.state === 'revoked' || c.state === 'expired');
        else if (stateFilter !== 'all') all = all.filter(c => c.state === stateFilter);
        // Client-side search
        if (search) {
          const q = search.toLowerCase();
          all = all.filter(c => (c.system_name||'').toLowerCase().includes(q) || (c.organization_name||'').toLowerCase().includes(q) || (c.certificate_number||'').toLowerCase().includes(q));
        }
        // Client-side sort
        all.sort((a, b) => {
          const av = a[sortBy] || '', bv = b[sortBy] || '';
          return sortOrder === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
        setCerts(all);
        setTotal(all.length);
      } catch { setCerts([]); setTotal(0); }
    }
    setLoading(false);
  }, [offset, sortBy, sortOrder, search, stateFilter]);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSort = (field, order) => { setSortBy(field); setSortOrder(order); setOffset(0); };
  const handleFilter = (key) => { setStateFilter(key); setOffset(0); };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: styles.textDim }} />
          <input
            type="text" placeholder="Search by name, org, or certificate #..."
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid ' + styles.borderGlass, background: styles.cardSurface, color: styles.textPrimary, fontFamily: styles.mono, fontSize: '12px', outline: 'none' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid ' + styles.borderSubtle, marginBottom: '16px' }}>
        {TABS.map(tab => {
          const active = stateFilter === tab.key;
          const count = counts[tab.key] || 0;
          return (
            <button key={tab.key} onClick={() => handleFilter(tab.key)} style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
              color: active ? styles.purpleBright : styles.textTertiary,
              borderBottom: active ? '2px solid ' + styles.purpleBright : '2px solid transparent',
              transition: 'color 0.2s',
            }}>
              {tab.label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: styles.cardSurface, border: '1px solid ' + styles.borderGlass, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortHeader label="Organization" field="organization_name" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <SortHeader label="System" field="system_name" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <SortHeader label="Certificate #" field="certificate_number" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <SortHeader label="Status" field="state" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <SortHeader label="Expires" field="expires_at" currentSort={sortBy} currentOrder={sortOrder} onChange={handleSort} />
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: styles.mono, color: styles.textTertiary, borderBottom: '1px solid ' + styles.borderGlass }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '11px' }}>Loading...</td></tr>
            ) : certs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: styles.textTertiary, fontSize: '14px' }}>
                {search ? 'No certificates match "' + search + '"' : 'No ' + (stateFilter === 'all' ? '' : stateFilter + ' ') + 'certificates'}
              </td></tr>
            ) : certs.map(c => {
              const daysLeft = c.expires_at ? Math.ceil((new Date(c.expires_at) - Date.now()) / (1000*60*60*24)) : null;
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid ' + styles.borderSubtle, transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px', fontWeight: 500, fontSize: '13px' }}>{c.application_id ? <Link to={'/applications/' + c.application_id} style={{ color: styles.textPrimary, textDecoration: 'none' }} onMouseEnter={e => e.target.style.color = styles.purpleBright} onMouseLeave={e => e.target.style.color = styles.textPrimary}>{c.organization_name}</Link> : c.organization_name}</td>
                  <td style={{ padding: '12px', color: styles.textSecondary, fontSize: '13px' }}>{c.system_name}</td>
                  <td style={{ padding: '12px', fontFamily: styles.mono, fontSize: '12px' }}>
                    <Link to={'/verify?cert=' + c.certificate_number} style={{ color: styles.purpleBright, textDecoration: 'none' }}>{c.certificate_number}</Link>
                  </td>
                  <td style={{ padding: '12px' }}><Badge variant={certVariant(c.state)}>{c.state}</Badge></td>
                  <td style={{ padding: '12px', fontFamily: styles.mono, fontSize: '12px', color: daysLeft !== null && daysLeft <= 30 ? (daysLeft <= 7 ? styles.accentRed : styles.accentAmber) : styles.textTertiary }}>
                    {c.expires_at ? new Date(c.expires_at).toISOString().substring(0,10) : '—'}
                    {daysLeft !== null && daysLeft <= 30 && <span style={{ marginLeft: '6px', fontSize: '10px' }}>({daysLeft}d)</span>}
                  </td>
                  <td style={{ padding: '12px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isActiveState(c.state) && (
                        <a href={API_BASE + '/api/v1/certificates/' + c.certificate_number + '/pdf'} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.purpleBright, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none' }}>
                          <Download size={10} /> PDF
                        </a>
                      )}
                      <Link to={'/verify?cert=' + c.certificate_number}
                        style={{ padding: '4px 10px', border: '1px solid ' + styles.borderGlass, background: 'transparent', color: styles.textTertiary, fontFamily: styles.mono, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', textDecoration: 'none' }}>
                        Verify
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onChange={setOffset} />
      </div>
    </div>
  );
}

export default CertificatesPage;
