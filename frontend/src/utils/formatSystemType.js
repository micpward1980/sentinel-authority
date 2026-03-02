import { SYSTEM_TYPES } from '../systemTypesData';

export function formatSystemType(key) {
  if (!key) return '—';
  return SYSTEM_TYPES[key]?.label || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
