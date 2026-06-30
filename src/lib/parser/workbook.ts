import { read, utils } from 'xlsx';
import type { Session } from './types';
import {
  parseDayTokens,
  parseTimeRange,
  parseDateRange,
  parseLocation,
  parseSectionCode,
  parseCourseListing,
  parseTermFromDescriptor
} from './fields';

type Cell = string | number | Date | null;

const HEADER_MARKERS = ['Course Listing', 'Meeting Patterns', 'Instructional Format'];

function detectHeader(rows: Cell[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const vals = rows[i].map((c) => (c == null ? '' : String(c)));
    if (HEADER_MARKERS.every((m) => vals.includes(m))) return i;
  }
  throw new Error('Could not find a header row — is this a "View My Courses" export?');
}

function colMap(header: Cell[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((c, i) => {
    if (c != null && String(c).trim()) map[String(c).trim()] = i;
  });
  return map;
}

function blankSession(): Session {
  return {
    courseCode: '',
    title: '',
    section: '',
    component: '',
    deliveryMode: '',
    days: [],
    startTime: '',
    endTime: '',
    rangeStart: '',
    rangeEnd: '',
    location: null,
    instructor: null,
    term: '',
    status: '',
    included: false,
    flags: []
  };
}

export function parseRows(rows: Cell[][]): Session[] {
  const h = detectHeader(rows);
  const cols = colMap(rows[h]);
  const get = (row: Cell[], name: string): string => {
    const i = cols[name];
    const v = i == null ? null : row[i];
    return v == null ? '' : String(v);
  };
  const out: Session[] = [];

  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;

    const descriptor = row[0] == null ? '' : String(row[0]);
    const term = parseTermFromDescriptor(descriptor);
    const { courseCode, title } = parseCourseListing(get(row, 'Course Listing'));
    const section = parseSectionCode(get(row, 'Section'));
    const component = get(row, 'Instructional Format');
    const deliveryMode = get(row, 'Delivery Mode');
    const status = get(row, 'Registration Status');
    const instructorRaw = get(row, 'Instructor').trim();
    const instructor = instructorRaw || null;

    const base = { courseCode, title, section, component, deliveryMode, term, status, instructor };

    if (status !== 'Registered') {
      out.push({ ...blankSession(), ...base, included: false, flags: ['not-registered'] });
      continue;
    }

    const cell = get(row, 'Meeting Patterns');
    const blocks = cell
      .split(/\r?\n\s*\r?\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    if (blocks.length === 0) {
      out.push({ ...blankSession(), ...base, included: false, flags: ['no-meeting-time'] });
      continue;
    }

    for (const block of blocks) {
      try {
        const parts = block.split('|').map((p) => p.trim());
        const [dateStr, dayStr, timeStr, ...locParts] = parts;
        if (/tba/i.test(timeStr) || /tba/i.test(dayStr)) {
          out.push({ ...blankSession(), ...base, included: false, flags: ['no-meeting-time'] });
          continue;
        }
        const { rangeStart, rangeEnd } = parseDateRange(dateStr);
        const days = parseDayTokens(dayStr);
        const { startTime, endTime } = parseTimeRange(timeStr);
        if (days.length === 0) {
          out.push({ ...blankSession(), ...base, included: false, flags: ['no-meeting-time'] });
          continue;
        }
        out.push({
          ...blankSession(),
          ...base,
          days,
          startTime,
          endTime,
          rangeStart,
          rangeEnd,
          location: parseLocation(locParts),
          included: true,
          flags: []
        });
      } catch {
        out.push({ ...blankSession(), ...base, included: false, flags: ['parse-error'] });
      }
    }
  }
  return out;
}

// Workday exports ship a truncated worksheet dimension (often "!ref": "A1"),
// which makes SheetJS read only the first cell. Recompute the true range from
// the actual cell addresses so every row is seen.
export function fixRange(sheet: Record<string, unknown>): void {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue;
    const { r, c } = utils.decode_cell(key);
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  if (maxR < 0) return;
  sheet['!ref'] = utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
}

export function parseWorkbook(buf: ArrayBuffer): Session[] {
  const wb = read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  fixRange(sheet as Record<string, unknown>);
  const rows = utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null });
  return parseRows(rows);
}
