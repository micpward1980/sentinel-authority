import React from 'react';
import { styles } from '../config/styles';

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"64px 24px",textAlign:"center"}}>
      <div style={{width:"64px",height:"64px",borderRadius:"16px",background:"rgba(91,75,138,0.12)",border:"1px solid rgba(157,140,207,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"20px"}}>
        <Icon size={28} style={{color:styles.purpleBright,opacity:0.7}} />
      </div>
      <h3 style={{color:styles.textPrimary,fontSize:"16px",fontWeight:500,margin:"0 0 8px 0",fontFamily:"Source Serif 4, Georgia, serif"}}>{title}</h3>
      <p style={{color:styles.textTertiary,fontSize:"13px",lineHeight:"1.5",maxWidth:"340px",margin:"0 0 24px 0"}}>{description}</p>
      {actionLabel && <button onClick={onAction} style={{background:"linear-gradient(135deg, "+styles.purplePrimary+" 0%, "+styles.purpleBright+" 100%)",border:"none",borderRadius:"8px",padding:"10px 24px",color:"#fff",fontFamily:"IBM Plex Mono, monospace",fontSize:"11px",letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer"}}>{actionLabel}</button>}
    </div>
  );
}

export default EmptyState;

