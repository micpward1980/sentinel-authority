import { useState, useCallback } from 'react';

export function useCopyToClipboard(resetMs = 1500) {
  const [copied, setCopied] = useState(null);

  const copy = useCallback((text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key ?? text);
      setTimeout(() => setCopied(null), resetMs);
    }).catch(() => {});
  }, [resetMs]);

  return { copy, copied };
}
