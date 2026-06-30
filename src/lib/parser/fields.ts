const DAY_MAP: Record<string, string> = {
  mon: 'MO',
  tue: 'TU',
  wed: 'WE',
  thu: 'TH',
  fri: 'FR',
  sat: 'SA',
  sun: 'SU'
};

export function parseDayTokens(s: string): string[] {
  return s
    .trim()
    .split(/\s+/)
    .map((t) => DAY_MAP[t.slice(0, 3).toLowerCase()])
    .filter(Boolean) as string[];
}

function to24h(raw: string): string {
  // "3:00 p.m." -> "15:00"
  const m = raw.trim().toLowerCase().match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)/);
  if (!m) throw new Error(`bad time: ${raw}`);
  let h = parseInt(m[1], 10);
  const min = m[2];
  const pm = m[3] === 'p.m.';
  if (h === 12) h = pm ? 12 : 0;
  else if (pm) h += 12;
  return `${String(h).padStart(2, '0')}:${min}`;
}

export function parseTimeRange(s: string): { startTime: string; endTime: string } {
  const [a, b] = s.split(/\s-\s/);
  return { startTime: to24h(a), endTime: to24h(b) };
}

export function parseDateRange(s: string): { rangeStart: string; rangeEnd: string } {
  const [a, b] = s.split(/\s-\s/).map((x) => x.trim());
  return { rangeStart: a, rangeEnd: b };
}

export function parseLocation(parts: string[]): string | null {
  const clean = parts.map((p) => p.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const codeMatch = clean.map((p) => p.match(/\(([A-Z]{2,5})\)/)).find(Boolean);
  const roomMatch = clean.map((p) => p.match(/Room:\s*(\S+)/)).find(Boolean);
  if (codeMatch && roomMatch) return `${codeMatch[1]} ${roomMatch[1]}`;
  return clean.join(', ') || null;
}

export function parseSectionCode(s: string): string {
  // "CPSC_V 320-T1E - Title" -> "T1E"
  const m = s.match(/-\s*([A-Z0-9]+)\s+-/) ?? s.match(/-([A-Z0-9]+)\b/);
  return m ? m[1] : s.trim();
}

export function parseCourseListing(s: string): { courseCode: string; title: string } {
  const idx = s.indexOf(' - ');
  if (idx === -1) return { courseCode: s.trim(), title: '' };
  return { courseCode: s.slice(0, idx).trim(), title: s.slice(idx + 3).trim() };
}

export function parseTermFromDescriptor(s: string): string {
  const m = s.match(/(\d{4}-\d{2}\s+Winter\s+Term\s+\d|\d{4}\s+Summer\s+Term\s+\d)/i);
  return m ? m[1].trim() : '';
}
