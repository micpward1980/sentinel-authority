import React from 'react';
import { styles } from '../config/styles';

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="hud-frame" style={{textAlign: 'center', padding: '56px 24px'}}>
      <div className="hud-corners" />
      <div style={{width: '48px', height: '48px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'}}>
        <Icon size={22} style={{color: styles.purpleBright, opacity: 0.5}} />
      </div>
      <h3 style={{color: styles.textPrimary, fontSize: '16px', fontWeight: 400, margin: '0 0 8px 0', fontFamily: styles.serif}}>{title}</h3>
      <p style={{color: styles.textTertiary, fontSize: '13px', lineHeight: '1.5', maxWidth: '340px', margin: '0 auto 24px'}}>{description}</p>
      {actionLabel && <button onClick={onAction} className="sa-primary" style={{padding: '10px 24px'}}>{actionLabel}</button>}
    </div>
  );
}

export default EmptyState;
