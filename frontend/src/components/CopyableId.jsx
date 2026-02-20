import React from 'react';
import { styles } from '../config/styles';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

/**
 * CopyableId
 * Renders a monospace ID with a click-to-copy interaction.
 * Shows "COPIED" flash on success.
 */
const CopyableId = React.memo(function CopyableId({ id, href, style = {} }) {
  const { copy, copied } = useCopyToClipboard();
  const isCopied = copied === id;

  const base = {
    fontFamily: styles.mono,
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: styles.purpleBright,
    textDecoration: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'color 0.15s',
    ...style,
  };

  const content = (
    <span
      title="Click to copy"
      onClick={e => { e.stopPropagation(); copy(id); }}
      style={base}
    >
      {isCopied ? '✓ COPIED' : id}
    </span>
  );

  if (href) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <a href={href} style={{ ...base, color: styles.purpleBright }}>{id}</a>
        <span
          title="Copy to clipboard"
          onClick={e => { e.stopPropagation(); copy(id); }}
          style={{ fontFamily: styles.mono, fontSize: '9px', color: isCopied ? styles.accentGreen : styles.textDim, cursor: 'pointer', letterSpacing: '0.06em' }}
        >
          {isCopied ? '✓' : '⎘'}
        </span>
      </span>
    );
  }

  return content;
});

export default CopyableId;
