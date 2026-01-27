// BoundaryEditor.jsx
// Add this component to the admin dashboard for defining structured boundaries during application review

import React, { useState, useEffect } from 'react';

// Styles matching existing dashboard
const styles = {
  bgPrimary: '#0d0d1a',
  bgSecondary: '#1a1a2e',
  bgTertiary: '#252540',
  textPrimary: '#e8e8f0',
  textSecondary: '#a0a0b0',
  textTertiary: '#6a6a80',
  purpleBright: '#8b5cf6',
  purpleDim: '#6d4aad',
  greenBright: '#10b981',
  redBright: '#ef4444',
  border: '#2a2a45',
};

const Panel = ({ children, style = {} }) => (
  <div style={{
    background: `linear-gradient(135deg, ${styles.bgSecondary} 0%, ${styles.bgTertiary} 100%)`,
    border: `1px solid ${styles.border}`,
    borderRadius: '12px',
    padding: '24px',
    ...style
  }}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', disabled = false, style = {} }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '12px',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      transition: 'all 0.2s',
      opacity: disabled ? 0.5 : 1,
      ...(variant === 'primary' ? {
        background: styles.purpleBright,
        color: 'white',
      } : variant === 'danger' ? {
        background: styles.redBright,
        color: 'white',
      } : {
        background: 'transparent',
        border: `1px solid ${styles.border}`,
        color: styles.textSecondary,
      }),
      ...style
    }}
  >
    {children}
  </button>
);

const Input = ({ label, value, onChange, type = 'text', placeholder = '', style = {} }) => (
  <div style={{ marginBottom: '12px', ...style }}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: '11px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: styles.textTertiary,
        marginBottom: '6px',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        {label}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 12px',
        background: styles.bgPrimary,
        border: `1px solid ${styles.border}`,
        borderRadius: '6px',
        color: styles.textPrimary,
        fontSize: '14px',
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    />
  </div>
);

const Select = ({ label, value, onChange, options, style = {} }) => (
  <div style={{ marginBottom: '12px', ...style }}>
    {label && (
      <label style={{
        display: 'block',
        fontSize: '11px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: styles.textTertiary,
        marginBottom: '6px',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        background: styles.bgPrimary,
        border: `1px solid ${styles.border}`,
        borderRadius: '6px',
        color: styles.textPrimary,
        fontSize: '14px',
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// ============================================
// BOUNDARY TYPE EDITORS
// ============================================

const NumericBoundaryEditor = ({ boundary, onChange, onRemove }) => (
  <Panel style={{ marginBottom: '12px', padding: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ color: styles.purpleBright, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
        NUMERIC BOUNDARY
      </span>
      <Button variant="danger" onClick={onRemove} style={{ padding: '4px 12px', fontSize: '10px' }}>
        Remove
      </Button>
    </div>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <Input
        label="Name"
        value={boundary.name || ''}
        onChange={(v) => onChange({ ...boundary, name: v })}
        placeholder="e.g., Speed Limit"
      />
      <Input
        label="Parameter"
        value={boundary.parameter || ''}
        onChange={(v) => onChange({ ...boundary, parameter: v })}
        placeholder="e.g., speed"
      />
      <Input
        label="Min Value"
        type="number"
        value={boundary.min_value ?? ''}
        onChange={(v) => onChange({ ...boundary, min_value: v || null })}
        placeholder="Optional"
      />
      <Input
        label="Max Value"
        type="number"
        value={boundary.max_value ?? ''}
        onChange={(v) => onChange({ ...boundary, max_value: v || null })}
        placeholder="Required"
      />
      <Input
        label="Unit"
        value={boundary.unit || ''}
        onChange={(v) => onChange({ ...boundary, unit: v })}
        placeholder="e.g., km/h, °C"
      />
      <Input
        label="Tolerance"
        type="number"
        value={boundary.tolerance || 0}
        onChange={(v) => onChange({ ...boundary, tolerance: v })}
        placeholder="0"
      />
    </div>
    
    <Select
      label="On Violation"
      value={boundary.violation_action || 'block'}
      onChange={(v) => onChange({ ...boundary, violation_action: v })}
      options={[
        { value: 'block', label: 'Block Action' },
        { value: 'warn', label: 'Warn Only' },
        { value: 'log', label: 'Log Only' },
      ]}
      style={{ marginTop: '12px', marginBottom: 0 }}
    />
  </Panel>
);

const GeoBoundaryEditor = ({ boundary, onChange, onRemove }) => (
  <Panel style={{ marginBottom: '12px', padding: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ color: styles.greenBright, fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
        GEOGRAPHIC BOUNDARY
      </span>
      <Button variant="danger" onClick={onRemove} style={{ padding: '4px 12px', fontSize: '10px' }}>
        Remove
      </Button>
    </div>
    
    <Input
      label="Name"
      value={boundary.name || ''}
      onChange={(v) => onChange({ ...boundary, name: v })}
      placeholder="e.g., Warehouse Zone"
    />
    
    <Select
      label="Boundary Type"
      value={boundary.boundary_type || 'circle'}
      onChange={(v) => onChange({ ...boundary, boundary_type: v })}
      options={[
        { value: 'circle', label: 'Circle (Center + Radius)' },
        { value: 'polygon', label: 'Polygon (Multiple Points)' },
      ]}
    />
    
    {boundary.boundary_type === 'circle' || !boundary.boundary_type ? (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <Input
          label="Center Latitude"
          type="number"
          value={boundary.center?.lat ?? ''}
          onChange={(v) => onChange({ ...boundary, center: { ...boundary.center, lat: v } })}
          placeholder="30.2672"
        />
        <Input
          label="Center Longitude"
          type="number"
          value={boundary.center?.lon ?? ''}
          onChange={(v) => onChange({ ...boundary, center: { ...boundary.center, lon: v } })}
          placeholder="-97.7431"
        />
        <Input
          label="Radius (meters)"
          type="number"
          value={boundary.radius_meters || ''}
          onChange={(v) => onChange({ ...boundary, radius_meters: v })}
          placeholder="1000"
        />
      </div>
    ) : (
      <div style={{ color: styles.textSecondary, fontSize: '12px', padding: '12px', background: styles.bgPrimary, borderRadius: '6px' }}>
        Polygon editor coming soon. For now, enter coordinates as JSON in the raw editor below.
      </div>
    )}
  </Panel>
);

const TimeBoundaryEditor = ({ boundary, onChange, onRemove }) => (
  <Panel style={{ marginBottom: '12px', padding: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ color: '#f59e0b', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
        TIME BOUNDARY
      </span>
      <Button variant="danger" onClick={onRemove} style={{ padding: '4px 12px', fontSize: '10px' }}>
        Remove
      </Button>
    </div>
    
    <Input
      label="Name"
      value={boundary.name || ''}
      onChange={(v) => onChange({ ...boundary, name: v })}
      placeholder="e.g., Operating Hours"
    />
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <Input
        label="Start Hour (0-23)"
        type="number"
        value={boundary.allowed_hours_start ?? 0}
        onChange={(v) => onChange({ ...boundary, allowed_hours_start: Math.min(23, Math.max(0, v)) })}
      />
      <Input
        label="End Hour (0-23)"
        type="number"
        value={boundary.allowed_hours_end ?? 23}
        onChange={(v) => onChange({ ...boundary, allowed_hours_end: Math.min(23, Math.max(0, v)) })}
      />
    </div>
    
    <div style={{ marginTop: '12px' }}>
      <label style={{
        display: 'block',
        fontSize: '11px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: styles.textTertiary,
        marginBottom: '8px',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        Allowed Days
      </label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
          const days = boundary.allowed_days || [0, 1, 2, 3, 4, 5, 6];
          const isSelected = days.includes(i);
          return (
            <button
              key={day}
              onClick={() => {
                const newDays = isSelected
                  ? days.filter(d => d !== i)
                  : [...days, i].sort();
                onChange({ ...boundary, allowed_days: newDays });
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: `1px solid ${isSelected ? styles.purpleBright : styles.border}`,
                background: isSelected ? styles.purpleBright : 'transparent',
                color: isSelected ? 'white' : styles.textSecondary,
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  </Panel>
);

const StateBoundaryEditor = ({ boundary, onChange, onRemove }) => (
  <Panel style={{ marginBottom: '12px', padding: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <span style={{ color: '#ec4899', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
        STATE BOUNDARY
      </span>
      <Button variant="danger" onClick={onRemove} style={{ padding: '4px 12px', fontSize: '10px' }}>
        Remove
      </Button>
    </div>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <Input
        label="Name"
        value={boundary.name || ''}
        onChange={(v) => onChange({ ...boundary, name: v })}
        placeholder="e.g., Operation Mode"
      />
      <Input
        label="Parameter"
        value={boundary.parameter || ''}
        onChange={(v) => onChange({ ...boundary, parameter: v })}
        placeholder="e.g., mode"
      />
    </div>
    
    <Input
      label="Allowed Values (comma-separated)"
      value={(boundary.allowed_values || []).join(', ')}
      onChange={(v) => onChange({ ...boundary, allowed_values: v.split(',').map(s => s.trim()).filter(Boolean) })}
      placeholder="e.g., idle, moving, charging"
    />
    
    <Input
      label="Forbidden Values (comma-separated)"
      value={(boundary.forbidden_values || []).join(', ')}
      onChange={(v) => onChange({ ...boundary, forbidden_values: v.split(',').map(s => s.trim()).filter(Boolean) })}
      placeholder="e.g., emergency, override"
      style={{ marginBottom: 0 }}
    />
  </Panel>
);

// ============================================
// MAIN BOUNDARY EDITOR
// ============================================

export default function BoundaryEditor({ applicationId, initialBoundaries, onSave, api }) {
  const [boundaries, setBoundaries] = useState({
    numeric_boundaries: [],
    geo_boundaries: [],
    time_boundaries: [],
    state_boundaries: [],
    safe_state: { action: 'stop', notify: true, log: true },
    fail_closed: true,
    telemetry_interval: 1.0,
    heartbeat_interval: 60.0,
  });
  
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawJson, setRawJson] = useState('');
  
  useEffect(() => {
    if (initialBoundaries && typeof initialBoundaries === 'object') {
      setBoundaries(prev => ({ ...prev, ...initialBoundaries }));
    }
  }, [initialBoundaries]);
  
  useEffect(() => {
    setRawJson(JSON.stringify(boundaries, null, 2));
  }, [boundaries]);
  
  const addBoundary = (type) => {
    const key = `${type}_boundaries`;
    const templates = {
      numeric: { type: 'numeric', name: '', parameter: '', max_value: null, unit: '', tolerance: 0, violation_action: 'block' },
      geo: { type: 'geo', name: '', boundary_type: 'circle', center: { lat: 0, lon: 0 }, radius_meters: 1000, violation_action: 'block' },
      time: { type: 'time', name: '', allowed_hours_start: 6, allowed_hours_end: 22, allowed_days: [0, 1, 2, 3, 4], violation_action: 'block' },
      state: { type: 'state', name: '', parameter: '', allowed_values: [], forbidden_values: [], violation_action: 'block' },
    };
    setBoundaries(prev => ({
      ...prev,
      [key]: [...prev[key], templates[type]]
    }));
  };
  
  const updateBoundary = (type, index, newBoundary) => {
    const key = `${type}_boundaries`;
    setBoundaries(prev => ({
      ...prev,
      [key]: prev[key].map((b, i) => i === index ? newBoundary : b)
    }));
  };
  
  const removeBoundary = (type, index) => {
    const key = `${type}_boundaries`;
    setBoundaries(prev => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index)
    }));
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(boundaries);
    } finally {
      setSaving(false);
    }
  };
  
  const handleRawSave = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setBoundaries(parsed);
      setShowRaw(false);
    } catch (e) {
      alert('Invalid JSON: ' + e.message);
    }
  };
  
  const totalBoundaries = 
    boundaries.numeric_boundaries.length +
    boundaries.geo_boundaries.length +
    boundaries.time_boundaries.length +
    boundaries.state_boundaries.length;
  
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ 
            fontFamily: "'IBM Plex Mono', monospace", 
            fontSize: '11px', 
            letterSpacing: '2px', 
            textTransform: 'uppercase', 
            color: styles.purpleBright,
            margin: 0 
          }}>
            Boundary Configuration
          </h2>
          <p style={{ color: styles.textSecondary, margin: '8px 0 0', fontSize: '14px' }}>
            {totalBoundaries} boundaries defined
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? 'Visual Editor' : 'Raw JSON'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Boundaries'}
          </Button>
        </div>
      </div>
      
      {showRaw ? (
        /* Raw JSON Editor */
        <Panel>
          <textarea
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            style={{
              width: '100%',
              minHeight: '400px',
              padding: '16px',
              background: styles.bgPrimary,
              border: `1px solid ${styles.border}`,
              borderRadius: '6px',
              color: styles.textPrimary,
              fontSize: '13px',
              fontFamily: "'IBM Plex Mono', monospace",
              resize: 'vertical',
            }}
          />
          <Button onClick={handleRawSave} style={{ marginTop: '12px' }}>
            Apply JSON
          </Button>
        </Panel>
      ) : (
        /* Visual Editor */
        <div>
          {/* Add Boundary Buttons */}
          <Panel style={{ marginBottom: '24px' }}>
            <p style={{ 
              fontSize: '11px', 
              letterSpacing: '1px', 
              textTransform: 'uppercase', 
              color: styles.textTertiary,
              margin: '0 0 12px',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              Add Boundary
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => addBoundary('numeric')}>
                + Numeric (Speed, Temp, etc.)
              </Button>
              <Button variant="secondary" onClick={() => addBoundary('geo')}>
                + Geographic (Geofence)
              </Button>
              <Button variant="secondary" onClick={() => addBoundary('time')}>
                + Time (Operating Hours)
              </Button>
              <Button variant="secondary" onClick={() => addBoundary('state')}>
                + State (Allowed Modes)
              </Button>
            </div>
          </Panel>
          
          {/* Numeric Boundaries */}
          {boundaries.numeric_boundaries.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: styles.textPrimary, fontSize: '14px', marginBottom: '12px' }}>
                Numeric Boundaries ({boundaries.numeric_boundaries.length})
              </h3>
              {boundaries.numeric_boundaries.map((b, i) => (
                <NumericBoundaryEditor
                  key={i}
                  boundary={b}
                  onChange={(newB) => updateBoundary('numeric', i, newB)}
                  onRemove={() => removeBoundary('numeric', i)}
                />
              ))}
            </div>
          )}
          
          {/* Geo Boundaries */}
          {boundaries.geo_boundaries.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: styles.textPrimary, fontSize: '14px', marginBottom: '12px' }}>
                Geographic Boundaries ({boundaries.geo_boundaries.length})
              </h3>
              {boundaries.geo_boundaries.map((b, i) => (
                <GeoBoundaryEditor
                  key={i}
                  boundary={b}
                  onChange={(newB) => updateBoundary('geo', i, newB)}
                  onRemove={() => removeBoundary('geo', i)}
                />
              ))}
            </div>
          )}
          
          {/* Time Boundaries */}
          {boundaries.time_boundaries.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: styles.textPrimary, fontSize: '14px', marginBottom: '12px' }}>
                Time Boundaries ({boundaries.time_boundaries.length})
              </h3>
              {boundaries.time_boundaries.map((b, i) => (
                <TimeBoundaryEditor
                  key={i}
                  boundary={b}
                  onChange={(newB) => updateBoundary('time', i, newB)}
                  onRemove={() => removeBoundary('time', i)}
                />
              ))}
            </div>
          )}
          
          {/* State Boundaries */}
          {boundaries.state_boundaries.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: styles.textPrimary, fontSize: '14px', marginBottom: '12px' }}>
                State Boundaries ({boundaries.state_boundaries.length})
              </h3>
              {boundaries.state_boundaries.map((b, i) => (
                <StateBoundaryEditor
                  key={i}
                  boundary={b}
                  onChange={(newB) => updateBoundary('state', i, newB)}
                  onRemove={() => removeBoundary('state', i)}
                />
              ))}
            </div>
          )}
          
          {/* Safe State & Settings */}
          <Panel>
            <h3 style={{ 
              fontSize: '11px', 
              letterSpacing: '1px', 
              textTransform: 'uppercase', 
              color: styles.textTertiary,
              margin: '0 0 16px',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              Enforcement Settings
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <Select
                label="On Violation"
                value={boundaries.safe_state?.action || 'stop'}
                onChange={(v) => setBoundaries(prev => ({ 
                  ...prev, 
                  safe_state: { ...prev.safe_state, action: v } 
                }))}
                options={[
                  { value: 'stop', label: 'Stop System' },
                  { value: 'reduce', label: 'Reduce Operation' },
                  { value: 'handoff', label: 'Human Handoff' },
                ]}
              />
              
              <Select
                label="Fail Mode"
                value={boundaries.fail_closed ? 'closed' : 'open'}
                onChange={(v) => setBoundaries(prev => ({ ...prev, fail_closed: v === 'closed' }))}
                options={[
                  { value: 'closed', label: 'Fail Closed (Block)' },
                  { value: 'open', label: 'Fail Open (Allow)' },
                ]}
              />
              
              <Input
                label="Telemetry Interval (sec)"
                type="number"
                value={boundaries.telemetry_interval || 1}
                onChange={(v) => setBoundaries(prev => ({ ...prev, telemetry_interval: v }))}
              />
            </div>
          </Panel>
          
          {/* Empty State */}
          {totalBoundaries === 0 && (
            <Panel style={{ textAlign: 'center', padding: '48px' }}>
              <p style={{ color: styles.textSecondary, fontSize: '16px', margin: 0 }}>
                No boundaries defined yet.
              </p>
              <p style={{ color: styles.textTertiary, fontSize: '14px', marginTop: '8px' }}>
                Add boundaries above to define the system's Operational Design Domain.
              </p>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
