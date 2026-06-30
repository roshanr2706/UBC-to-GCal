import type { Session } from '$lib/parser/types';

// FNV-1a 32-bit → hex; deterministic, no async crypto needed.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function syncKeyFor(s: Session): string {
  return 'ubc-' + fnv1a([s.courseCode, s.section, s.component, s.days.join(''), s.rangeStart].join('|'));
}
