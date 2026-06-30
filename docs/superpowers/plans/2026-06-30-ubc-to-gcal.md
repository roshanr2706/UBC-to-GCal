# UBC Schedule → Google Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static SvelteKit webapp that parses a UBC Workday "View My Courses" Excel export into calendar events, with a public `.ics` download and gated idempotent Google Calendar sync.

**Architecture:** Pure client-side. SheetJS parses the workbook → typed `Session[]` → a preview table with per-row include/exclude → either a hand-rolled ICS string (download) or Google Calendar API insert/patch (sync). No backend; `localStorage` for prefs.

**Tech Stack:** SvelteKit + `adapter-static`, TypeScript, Tailwind + shadcn-svelte, SheetJS (`xlsx`), Luxon, Google Identity Services, Vitest.

## Global Constraints

- All event times anchored to the named zone `America/Vancouver` (never a fixed UTC offset).
- Spreadsheet parsed entirely in-browser; raw file never uploaded; student number never logged or transmitted.
- **No gradients** anywhere — flat solid colors only, per `docs/styling-guide.md`.
- Components are `Lecture` | `Discussion` | `Laboratory` (not "Tutorial").
- Header row is detected by string match, not hardcoded index; column order read from header map.
- One `Session` per meeting-pattern block (Term-2 splits → two sessions).
- syncKey = `hash(courseCode + section + component + days.join("") + rangeStart)`.
- Static output only (`adapter-static`); persistence is `localStorage`.

---

### Task 0: Scaffold project + tooling + styling guide

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `src/app.css`, `src/app.html`, `src/routes/+layout.ts`, `src/routes/+page.svelte`, `docs/styling-guide.md`, `.env.example`
- Test: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: a buildable static SvelteKit app; `npm test` runs Vitest; `$lib` alias resolves to `src/lib`.

- [ ] **Step 1: Create SvelteKit + Vitest config**

`package.json`:
```json
{
  "name": "ubc-to-gcal",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.6",
    "@sveltejs/kit": "^2.8.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "svelte": "^5.1.0",
    "svelte-check": "^4.0.0",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "luxon": "^3.5.0",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
  }
}
```
Note: SheetJS is installed from its official CDN tarball (the npm `xlsx` package is deprecated/stale per SheetJS docs). Also add `@types/luxon` to devDependencies.

`svelte.config.js`:
```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    alias: { $lib: 'src/lib' }
  }
};
```

`vite.config.ts`:
```ts
import { sveltekit } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: { environment: 'node', include: ['src/**/*.{test,spec}.ts'] }
});
```

`src/routes/+layout.ts`:
```ts
export const prerender = true;
export const ssr = false;
```

- [ ] **Step 2: Install deps**

Run: `npm install`
Expected: completes; `node_modules` populated.

- [ ] **Step 3: Add Tailwind + shadcn-svelte base**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: { extend: {} },
  plugins: []
} satisfies Config;
```
`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```
`src/app.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
Then init shadcn-svelte: `npx shadcn-svelte@latest init` (style: default, base color: slate, CSS variables: yes), and add components used later:
`npx shadcn-svelte@latest add button table checkbox card select dialog sonner badge tabs`.

- [ ] **Step 4: Write the styling guide**

`docs/styling-guide.md` — flat palette (no gradients), neutral slate surfaces + single indigo accent, fixed 8-color course palette (solid hex), type scale, spacing scale, shadcn CSS-variable tokens. (Full content written during execution; must explicitly forbid `linear-gradient`/`radial-gradient`.)

- [ ] **Step 5: Smoke test**

`src/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "chore: scaffold SvelteKit + Tailwind + shadcn-svelte + Vitest"
```

---

### Task 1: Field sub-parsers (TDD)

**Files:**
- Create: `src/lib/parser/fields.ts`
- Test: `src/lib/parser/fields.test.ts`

**Interfaces:**
- Produces:
  - `parseDayTokens(s: string): string[]` → RFC5545 BYDAY codes
  - `parseTimeRange(s: string): { startTime: string; endTime: string }` → 24h `"HH:mm"`
  - `parseDateRange(s: string): { rangeStart: string; rangeEnd: string }` → ISO `"YYYY-MM-DD"`
  - `parseLocation(parts: string[]): string | null`
  - `parseSectionCode(s: string): string`
  - `parseCourseListing(s: string): { courseCode: string; title: string }`
  - `parseTermFromDescriptor(s: string): string`

- [ ] **Step 1: Write failing tests**

`src/lib/parser/fields.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  parseDayTokens, parseTimeRange, parseDateRange,
  parseLocation, parseSectionCode, parseCourseListing, parseTermFromDescriptor
} from './fields';

describe('parseDayTokens', () => {
  it('maps weekday tokens to BYDAY', () => {
    expect(parseDayTokens('Mon Wed Fri')).toEqual(['MO', 'WE', 'FR']);
    expect(parseDayTokens('Tue Thu')).toEqual(['TU', 'TH']);
    expect(parseDayTokens('Sat Sun')).toEqual(['SA', 'SU']);
  });
});

describe('parseTimeRange', () => {
  it('parses am/pm into 24h', () => {
    expect(parseTimeRange('3:00 p.m. - 4:00 p.m.')).toEqual({ startTime: '15:00', endTime: '16:00' });
    expect(parseTimeRange('11:00 a.m. - 1:00 p.m.')).toEqual({ startTime: '11:00', endTime: '13:00' });
    expect(parseTimeRange('12:00 p.m. - 1:00 p.m.')).toEqual({ startTime: '12:00', endTime: '13:00' });
  });
});

describe('parseDateRange', () => {
  it('splits ISO range', () => {
    expect(parseDateRange('2026-09-09 - 2026-12-07')).toEqual({ rangeStart: '2026-09-09', rangeEnd: '2026-12-07' });
  });
});

describe('parseLocation', () => {
  it('builds compact code+room', () => {
    expect(parseLocation(['UBCV', 'West Mall Swing Space Building (SWNG)', 'Floor: 2', 'Room: 222'])).toBe('SWNG 222');
  });
  it('returns null when absent', () => {
    expect(parseLocation([])).toBeNull();
    expect(parseLocation([''])).toBeNull();
  });
});

describe('parseSectionCode', () => {
  it('extracts the section token', () => {
    expect(parseSectionCode('CPSC_V 320-T1E - Intermediate Algorithm Design and Analysis')).toBe('T1E');
    expect(parseSectionCode('CPSC_V 310-L1M - Introduction to Software Engineering')).toBe('L1M');
    expect(parseSectionCode('CPSC_V 320-101 - x')).toBe('101');
  });
});

describe('parseCourseListing', () => {
  it('splits code and title', () => {
    expect(parseCourseListing('CPSC_V 320 - Intermediate Algorithm Design and Analysis'))
      .toEqual({ courseCode: 'CPSC_V 320', title: 'Intermediate Algorithm Design and Analysis' });
  });
});

describe('parseTermFromDescriptor', () => {
  it('extracts the term', () => {
    const s = 'Roshan Ramchandani (82418484) - Faculty of Science (Vancouver)/Undergraduate (B.Sc.) - 2025-06-19 - Active - CPSC_V 320 - Intermediate Algorithm Design and Analysis - 2026-27 Winter Term 1 (UBC-V)';
    expect(parseTermFromDescriptor(s)).toBe('2026-27 Winter Term 1');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/parser/fields.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/lib/parser/fields.ts`:
```ts
const DAY_MAP: Record<string, string> = {
  mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU'
};

export function parseDayTokens(s: string): string[] {
  return s.trim().split(/\s+/)
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
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/parser/fields.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/parser/fields.ts src/lib/parser/fields.test.ts
git commit -m "feat: meeting-pattern field sub-parsers with tests"
```

---

### Task 2: Workbook → Session[] parser (TDD)

**Files:**
- Create: `src/lib/parser/types.ts`, `src/lib/parser/workbook.ts`
- Test: `src/lib/parser/workbook.test.ts`

**Interfaces:**
- Consumes: all of `fields.ts`.
- Produces:
  - `interface Session { courseCode; title; section; component; deliveryMode; days: string[]; startTime; endTime; rangeStart; rangeEnd; location: string|null; instructor: string|null; term; status; included: boolean; flags: string[]; }`
  - `parseRows(rows: (string|number|Date|null)[][]): Session[]` — accepts a 2-D array-of-arrays (sheet rows), returns sessions. (Decoupling from SheetJS makes it unit-testable; a thin `parseWorkbook(file)` wrapper calls SheetJS then `parseRows`.)
  - `parseWorkbook(file: ArrayBuffer): Session[]`

- [ ] **Step 1: Write failing tests** (fixtures mirror the real file)

`src/lib/parser/workbook.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseRows } from './workbook';

const HEADER = [null, 'Course Listing', 'Drop', 'Swap', 'Credits', 'Grading Basis',
  'Section', 'Registration Status', 'Instructional Format', 'Delivery Mode',
  'Meeting Patterns', 'Instructor', 'Start Date', 'End Date'];

const DESC = (course: string, term: string) =>
  `Roshan Ramchandani (82418484) - Faculty of Science - 2025-06-19 - Active - ${course} - Title - ${term} (UBC-V)`;

function rowsWith(...data: any[][]) {
  return [['My Enrolled Courses'], [null, null, null, null, null, null, 'Enrolled Sections'], HEADER, ...data];
}

describe('parseRows', () => {
  it('parses a single-block Term 1 lecture', () => {
    const rows = rowsWith([
      DESC('CPSC_V 320', '2026-27 Winter Term 1'),
      'CPSC_V 320 - Intermediate Algorithm Design and Analysis', null, null, 3, 'Graded',
      'CPSC_V 320-101 - x', 'Registered', 'Lecture', 'In Person Learning',
      '2026-09-09 - 2026-12-07 | Mon Wed Fri | 3:00 p.m. - 4:00 p.m. | UBCV | West Mall Swing Space Building (SWNG) | Floor: 2 | Room: 222',
      null, null, null
    ]);
    const s = parseRows(rows);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      courseCode: 'CPSC_V 320', section: '101', component: 'Lecture',
      days: ['MO', 'WE', 'FR'], startTime: '15:00', endTime: '16:00',
      rangeStart: '2026-09-09', rangeEnd: '2026-12-07', location: 'SWNG 222',
      term: '2026-27 Winter Term 1', status: 'Registered', included: true, flags: []
    });
  });

  it('splits a Term 2 two-block lecture into two sessions', () => {
    const rows = rowsWith([
      DESC('CPSC_V 317', '2026-27 Winter Term 2'),
      'CPSC_V 317 - Introduction to Computer Networking', null, null, 3, 'Graded',
      'CPSC_V 317-202 - x', 'Registered', 'Lecture', 'In Person Learning',
      '2027-01-06 - 2027-02-12 | Mon Wed Fri | 11:00 a.m. - 12:00 p.m. | UBCV | HR MacMillan Building (MCML) | Floor: 3 | Room: 360\n\n2027-02-22 - 2027-04-12 | Mon Wed Fri | 11:00 a.m. - 12:00 p.m. | UBCV | HR MacMillan Building (MCML) | Floor: 3 | Room: 360',
      null, null, null
    ]);
    const s = parseRows(rows);
    expect(s).toHaveLength(2);
    expect(s[0].rangeStart).toBe('2027-01-06');
    expect(s[1].rangeStart).toBe('2027-02-22');
    expect(s[0].days).toEqual(['MO', 'WE', 'FR']);
  });

  it('handles a lab with no location', () => {
    const rows = rowsWith([
      DESC('CPSC_V 310', '2026-27 Winter Term 1'),
      'CPSC_V 310 - Introduction to Software Engineering', null, null, 4, 'Graded',
      'CPSC_V 310-L1M - x', 'Registered', 'Laboratory', 'In Person Learning',
      '2026-09-14 - 2026-12-07 | Mon | 11:00 a.m. - 1:00 p.m. |',
      null, null, null
    ]);
    const s = parseRows(rows);
    expect(s[0].location).toBeNull();
    expect(s[0].component).toBe('Laboratory');
  });

  it('flags and excludes a non-registered row', () => {
    const rows = rowsWith([
      DESC('CPSC_V 999', '2026-27 Winter Term 1'),
      'CPSC_V 999 - x', null, null, 3, 'Graded', 'CPSC_V 999-101 - x',
      'Waitlisted', 'Lecture', 'In Person Learning',
      '2026-09-09 - 2026-12-07 | Mon | 9:00 a.m. - 10:00 a.m. |', null, null, null
    ]);
    const s = parseRows(rows);
    expect(s[0].included).toBe(false);
    expect(s[0].flags).toContain('not-registered');
  });

  it('flags an async row with no meeting pattern', () => {
    const rows = rowsWith([
      DESC('CPSC_V 555', '2026-27 Winter Term 1'),
      'CPSC_V 555 - x', null, null, 3, 'Graded', 'CPSC_V 555-101 - x',
      'Registered', 'Lecture', 'Online', '', null, null, null
    ]);
    const s = parseRows(rows);
    expect(s[0].flags).toContain('no-meeting-time');
    expect(s[0].included).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/parser/workbook.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement types + parser**

`src/lib/parser/types.ts`:
```ts
export interface Session {
  courseCode: string;
  title: string;
  section: string;
  component: string;
  deliveryMode: string;
  days: string[];
  startTime: string;
  endTime: string;
  rangeStart: string;
  rangeEnd: string;
  location: string | null;
  instructor: string | null;
  term: string;
  status: string;
  included: boolean;
  flags: string[];
}
```

`src/lib/parser/workbook.ts`:
```ts
import { read, utils } from 'xlsx';
import type { Session } from './types';
import {
  parseDayTokens, parseTimeRange, parseDateRange, parseLocation,
  parseSectionCode, parseCourseListing, parseTermFromDescriptor
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
  header.forEach((c, i) => { if (c != null && String(c).trim()) map[String(c).trim()] = i; });
  return map;
}

function blankSession(): Session {
  return {
    courseCode: '', title: '', section: '', component: '', deliveryMode: '',
    days: [], startTime: '', endTime: '', rangeStart: '', rangeEnd: '',
    location: null, instructor: null, term: '', status: '', included: false, flags: []
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
    const blocks = cell.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
    if (blocks.length === 0) {
      out.push({ ...blankSession(), ...base, included: false, flags: ['no-meeting-time'] });
      continue;
    }

    for (const block of blocks) {
      try {
        const parts = block.split('|').map((p) => p.trim());
        const [dateStr, dayStr, timeStr, ...locParts] = parts;
        const { rangeStart, rangeEnd } = parseDateRange(dateStr);
        const days = parseDayTokens(dayStr);
        const { startTime, endTime } = parseTimeRange(timeStr);
        if (days.length === 0 || /tba/i.test(timeStr)) {
          out.push({ ...blankSession(), ...base, included: false, flags: ['no-meeting-time'] });
          continue;
        }
        out.push({
          ...blankSession(), ...base,
          days, startTime, endTime, rangeStart, rangeEnd,
          location: parseLocation(locParts), included: true, flags: []
        });
      } catch {
        out.push({ ...blankSession(), ...base, included: false, flags: ['parse-error'] });
      }
    }
  }
  return out;
}

export function parseWorkbook(buf: ArrayBuffer): Session[] {
  const wb = read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null });
  return parseRows(rows);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/parser/workbook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/parser/
git commit -m "feat: workbook parser producing normalized Session[]"
```

---

### Task 3: syncKey hash util (TDD)

**Files:**
- Create: `src/lib/sync/syncKey.ts`
- Test: `src/lib/sync/syncKey.test.ts`

**Interfaces:**
- Consumes: `Session`.
- Produces: `syncKeyFor(s: Session): string` (stable, deterministic, collision-safe across Term-2 split).

- [ ] **Step 1: Failing test**

`src/lib/sync/syncKey.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { syncKeyFor } from './syncKey';
import type { Session } from '$lib/parser/types';

const base: Session = {
  courseCode: 'CPSC_V 317', title: '', section: '202', component: 'Lecture', deliveryMode: '',
  days: ['MO', 'WE', 'FR'], startTime: '11:00', endTime: '12:00',
  rangeStart: '2027-01-06', rangeEnd: '2027-02-12', location: null, instructor: null,
  term: 'T2', status: 'Registered', included: true, flags: []
};

describe('syncKeyFor', () => {
  it('is deterministic', () => {
    expect(syncKeyFor(base)).toBe(syncKeyFor({ ...base }));
  });
  it('differs across the Term-2 split (rangeStart)', () => {
    const second = { ...base, rangeStart: '2027-02-22', rangeEnd: '2027-04-12' };
    expect(syncKeyFor(base)).not.toBe(syncKeyFor(second));
  });
  it('differs across component', () => {
    expect(syncKeyFor(base)).not.toBe(syncKeyFor({ ...base, component: 'Discussion' }));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/sync/syncKey.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/sync/syncKey.ts`:
```ts
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
```

- [ ] **Step 4: Run, verify pass** → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/sync/syncKey.ts src/lib/sync/syncKey.test.ts
git commit -m "feat: collision-safe syncKey (includes rangeStart)"
```

---

### Task 4: ICS generator (TDD)

**Files:**
- Create: `src/lib/ics/vtimezone.ts`, `src/lib/ics/generate.ts`
- Test: `src/lib/ics/generate.test.ts`

**Interfaces:**
- Consumes: `Session`, `syncKeyFor`.
- Produces: `generateICS(sessions: Session[]): string` — RFC5545 VCALENDAR with one VEVENT per included session, Vancouver VTIMEZONE, weekly RRULE.

- [ ] **Step 1: Failing test**

`src/lib/ics/generate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateICS } from './generate';
import type { Session } from '$lib/parser/types';

const session: Session = {
  courseCode: 'CPSC_V 320', title: 'Intermediate Algorithm Design and Analysis', section: '101',
  component: 'Lecture', deliveryMode: 'In Person Learning', days: ['MO', 'WE', 'FR'],
  startTime: '15:00', endTime: '16:00', rangeStart: '2026-09-09', rangeEnd: '2026-12-07',
  location: 'SWNG 222', instructor: null, term: '2026-27 Winter Term 1',
  status: 'Registered', included: true, flags: []
};

describe('generateICS', () => {
  const ics = generateICS([session]);
  it('includes VCALENDAR + Vancouver VTIMEZONE', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('TZID:America/Vancouver');
  });
  it('anchors DTSTART to the named zone with correct local time', () => {
    expect(ics).toContain('DTSTART;TZID=America/Vancouver:20260909T150000');
    expect(ics).toContain('DTEND;TZID=America/Vancouver:20260909T160000');
  });
  it('emits a weekly RRULE on the right days', () => {
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=');
  });
  it('skips excluded sessions', () => {
    expect(generateICS([{ ...session, included: false }])).not.toContain('BEGIN:VEVENT');
  });
});
```

- [ ] **Step 2: Run, verify fail** → FAIL.

- [ ] **Step 3: Implement**

`src/lib/ics/vtimezone.ts`: export a constant string holding a standards-compliant `BEGIN:VTIMEZONE … TZID:America/Vancouver … END:VTIMEZONE` block (STANDARD = PST −0800, DAYLIGHT = PDT −0700, US DST rules). (Full literal written during execution.)

`src/lib/ics/generate.ts`:
```ts
import { DateTime } from 'luxon';
import type { Session } from '$lib/parser/types';
import { syncKeyFor } from '$lib/sync/syncKey';
import { VANCOUVER_VTIMEZONE } from './vtimezone';

const DOW: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };

function fold(line: string): string {
  // RFC5545 75-octet line folding
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let s = line;
  chunks.push(s.slice(0, 75));
  s = s.slice(75);
  while (s.length > 74) { chunks.push(' ' + s.slice(0, 74)); s = s.slice(74); }
  if (s) chunks.push(' ' + s);
  return chunks.join('\r\n');
}

function firstOccurrence(rangeStart: string, days: string[]): DateTime {
  const start = DateTime.fromISO(rangeStart, { zone: 'America/Vancouver' });
  const wanted = days.map((d) => DOW[d]).sort((a, b) => a - b);
  for (let i = 0; i < 7; i++) {
    const cand = start.plus({ days: i });
    if (wanted.includes(cand.weekday)) return cand;
  }
  return start;
}

function untilUtc(rangeEnd: string): string {
  // inclusive end-of-day in Vancouver, expressed in UTC Z time
  return DateTime.fromISO(rangeEnd, { zone: 'America/Vancouver' })
    .endOf('day').toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function esc(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function vevent(s: Session): string {
  const first = firstOccurrence(s.rangeStart, s.days);
  const date = first.toFormat('yyyyMMdd');
  const dtstamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const key = syncKeyFor(s);
  const summary = `${s.courseCode} ${s.component}`;
  const descParts = [
    s.section && `Section ${s.section}`,
    s.instructor && `Instructor: ${s.instructor}`,
    s.term
  ].filter(Boolean).join('\\n');
  const lines = [
    'BEGIN:VEVENT',
    `UID:${key}@ubc-to-gcal`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=America/Vancouver:${date}T${s.startTime.replace(':', '')}00`,
    `DTEND;TZID=America/Vancouver:${date}T${s.endTime.replace(':', '')}00`,
    `RRULE:FREQ=WEEKLY;BYDAY=${s.days.join(',')};UNTIL=${untilUtc(s.rangeEnd)}`,
    `SUMMARY:${esc(summary)}`,
    s.location ? `LOCATION:${esc(s.location)}` : '',
    `DESCRIPTION:${esc(descParts)}`,
    'END:VEVENT'
  ].filter(Boolean);
  return lines.map(fold).join('\r\n');
}

export function generateICS(sessions: Session[]): string {
  const events = sessions.filter((s) => s.included && s.flags.length === 0).map(vevent);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ubc-to-gcal//EN',
    'CALSCALE:GREGORIAN',
    VANCOUVER_VTIMEZONE.trim(),
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}
```

- [ ] **Step 4: Run, verify pass** → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ics/
git commit -m "feat: hand-rolled ICS generator with Vancouver VTIMEZONE + RRULE"
```

---

### Task 5: Course color palette + stores (TDD)

**Files:**
- Create: `src/lib/ui/colors.ts`, `src/lib/stores/sessions.ts`
- Test: `src/lib/ui/colors.test.ts`

**Interfaces:**
- Produces:
  - `courseColor(courseCode: string, allCodes: string[]): string` — stable solid hex per course from a fixed 8-color palette (no gradients).
  - `sessions` writable store of `Session[]`; `toggleInclude(index)`.

- [ ] **Step 1: Failing test**

`src/lib/ui/colors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { courseColor, COURSE_PALETTE } from './colors';

describe('courseColor', () => {
  const codes = ['CPSC_V 320', 'CPSC_V 310', 'EOSC_V 315'];
  it('assigns a palette color', () => {
    expect(COURSE_PALETTE).toContain(courseColor('CPSC_V 320', codes));
  });
  it('is stable for the same course', () => {
    expect(courseColor('CPSC_V 310', codes)).toBe(courseColor('CPSC_V 310', codes));
  });
  it('gives distinct colors to distinct courses within palette size', () => {
    expect(courseColor('CPSC_V 320', codes)).not.toBe(courseColor('CPSC_V 310', codes));
  });
});
```

- [ ] **Step 2: Run, verify fail** → FAIL.

- [ ] **Step 3: Implement**

`src/lib/ui/colors.ts`:
```ts
// Flat solid colors only — no gradients (styling guide).
export const COURSE_PALETTE = [
  '#4f46e5', '#0891b2', '#16a34a', '#ca8a04',
  '#dc2626', '#9333ea', '#db2777', '#0d9488'
];

export function courseColor(code: string, allCodes: string[]): string {
  const unique = Array.from(new Set(allCodes));
  const idx = unique.indexOf(code);
  return COURSE_PALETTE[(idx < 0 ? 0 : idx) % COURSE_PALETTE.length];
}
```

`src/lib/stores/sessions.ts`:
```ts
import { writable } from 'svelte/store';
import type { Session } from '$lib/parser/types';

export const sessions = writable<Session[]>([]);

export function toggleInclude(index: number) {
  sessions.update((list) =>
    list.map((s, i) => (i === index ? { ...s, included: !s.included } : s))
  );
}
```

- [ ] **Step 4: Run, verify pass** → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/ui/colors.ts src/lib/ui/colors.test.ts src/lib/stores/sessions.ts
git commit -m "feat: fixed course color palette + sessions store"
```

---

### Task 6: Upload + preview UI + ICS download (manual-verify)

**Files:**
- Create: `src/lib/components/Uploader.svelte`, `src/lib/components/PreviewTable.svelte`, `src/lib/ics/download.ts`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `parseWorkbook`, `sessions` store, `toggleInclude`, `generateICS`, `courseColor`.
- Produces: `downloadICS(text: string, filename: string): void`.

- [ ] **Step 1: ICS download helper**

`src/lib/ics/download.ts`:
```ts
export function downloadICS(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Uploader component**

`src/lib/components/Uploader.svelte`: drag-drop + file picker (shadcn Card + Button). On file: `arrayBuffer()` → `parseWorkbook` → set `sessions` store. Catch parse errors → Sonner toast. Reads file in-browser only.

- [ ] **Step 3: PreviewTable component**

`src/lib/components/PreviewTable.svelte`: shadcn Table; one row per session; left color swatch via `courseColor`; columns course / component / days / time / date range / location / term; include/exclude Checkbox wired to `toggleInclude`; flagged rows get a shadcn Badge with the reason and are dimmed; empty-state card when no sessions.

- [ ] **Step 4: Wire the page**

`src/routes/+page.svelte`: header, `<Uploader/>`, `<PreviewTable/>`, action bar with **Download .ics** button → `generateICS($sessions)` → `downloadICS(text, 'ubc-schedule.ics')`. (Sync button stub added in Task 7.)

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the app, upload `View_My_Courses.xlsx`.
Expected: every session listed; Term-2 courses show two rows; the 310 lab shows blank location; toggles work; **Download .ics** produces a file. Import the `.ics` into Google Calendar and confirm a Term-1 event and a post-reading-week Term-2 event land at the correct `America/Vancouver` times.

- [ ] **Step 6: Commit**
```bash
git add src/lib/components/ src/lib/ics/download.ts src/routes/+page.svelte
git commit -m "feat: upload + preview table + .ics download (Phase 1 MVP)"
```

---

### Task 7: Google Calendar sync (manual-verify)

**Files:**
- Create: `src/lib/google/auth.ts`, `src/lib/google/calendar.ts`, `src/lib/components/SyncPanel.svelte`
- Modify: `src/routes/+page.svelte`, `.env.example`, `src/app.html`

**Interfaces:**
- Consumes: `Session`, `syncKeyFor`, `sessions` store.
- Produces:
  - `requestToken(): Promise<string>` (GIS token client, scope `calendar.events` + `calendar`)
  - `ensureCalendar(token, term): Promise<string>` (calendarId; create-once, cache in localStorage)
  - `eventFromSession(s): GoogleEvent` (RRULE + extendedProperties.private.syncKey + Vancouver TZID)
  - `syncSessions(token, calendarId, sessions): Promise<{inserted; patched; orphans}>`

- [ ] **Step 1: GIS loader + token**

`src/app.html`: add `<script src="https://accounts.google.com/gsi/client" async></script>`.
`.env.example`: `PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`.
`src/lib/google/auth.ts`: wrap `google.accounts.oauth2.initTokenClient({ client_id, scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar', callback })` in a Promise returning the access token.

- [ ] **Step 2: Calendar client**

`src/lib/google/calendar.ts`: `fetch` wrappers for `calendars.insert`, `calendarList`, `events.list?privateExtendedProperty=syncKey=…`, `events.insert`, `events.patch`. `eventFromSession` builds: `summary`, `location`, `start/end {dateTime, timeZone:'America/Vancouver'}` computed from first occurrence (reuse the Task-4 occurrence logic — extract to `src/lib/ics/recurrence.ts` and import in both), `recurrence:['RRULE:FREQ=WEEKLY;BYDAY=…;UNTIL=…']`, `extendedProperties.private.syncKey`. `syncSessions` loops included+unflagged sessions: list by syncKey → insert or patch; then lists all `ubc-`-tagged events and reports any whose syncKey isn't in the current set as `orphans`.

  Refactor note: extract `firstOccurrence`/`untilUtc` from `generate.ts` into `recurrence.ts` and import in both `generate.ts` and `calendar.ts` (DRY). Re-run Task-4 tests to confirm green after the move.

- [ ] **Step 3: SyncPanel component**

`src/lib/components/SyncPanel.svelte`: "Sign in with Google" → `requestToken`; calendar choice (dedicated "UBC Courses {term}" via Select/Dialog); "Sync now" → `syncSessions`; Sonner toasts for inserted/patched counts; orphans listed with a "these look dropped — delete in Google Calendar?" note. Remember last calendarId in localStorage.

- [ ] **Step 4: Wire into page** (`src/routes/+page.svelte`): add `<SyncPanel/>` to the action bar.

- [ ] **Step 5: Manual verification**

Set `PUBLIC_GOOGLE_CLIENT_ID` (OAuth client in Google Cloud, consent screen in Testing mode, your email allow-listed). `npm run dev`, sign in, sync. Confirm events appear once; **re-sync and confirm they are patched, not duplicated**; confirm a dropped course surfaces as an orphan.

- [ ] **Step 6: Commit**
```bash
git add src/lib/google/ src/lib/components/SyncPanel.svelte src/lib/ics/recurrence.ts src/lib/ics/generate.ts src/routes/+page.svelte src/app.html .env.example
git commit -m "feat: idempotent Google Calendar sync (Phase 2, Testing mode)"
```

---

### Task 8: Polish — responsive, localStorage prefs, error states

**Files:**
- Modify: `src/routes/+page.svelte`, `src/lib/components/PreviewTable.svelte`, `src/lib/components/SyncPanel.svelte`
- Create: `src/lib/stores/prefs.ts`

**Interfaces:**
- Produces: `prefs` store persisted to localStorage (`lastCalendarId`, `destinationMode`).

- [ ] **Step 1: prefs store**

`src/lib/stores/prefs.ts`: writable synced to `localStorage` (guard `typeof window`).

- [ ] **Step 2: Responsive layout** — PreviewTable becomes stacked cards under `sm`; action bar wraps; tested at 375px and desktop widths.

- [ ] **Step 3: Error states** — distinct visual treatment + copy for each flag (`not-registered`, `no-meeting-time`, `parse-error`) and a zero-rows empty state with guidance to re-export from Workday.

- [ ] **Step 4: Color-coding** — apply `courseColor` swatches in both table and (optional) Google event colorId mapping.

- [ ] **Step 5: Manual verification** — resize to mobile; reload to confirm prefs persist; upload a wrong file to confirm graceful empty/error state.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: polish — responsive layout, localStorage prefs, error states (Phase 3)"
```

---

## Self-Review

**Spec coverage:** §3 stack → Task 0. §4 format + §5 parser → Tasks 1–2. §6 ICS → Task 4. §7 syncKey + sync → Tasks 3, 7. §8 UI flow → Tasks 6, 8. §9 styling guide → Task 0 step 4. §10 edge cases → covered by Task 2 tests (split, no-location, non-registered, async) + Task 4 (DST via TZID) + Task 7 (orphans, idempotency). §11 testing → unit tests in Tasks 1–5, manual ICS import in Task 6, idempotency in Task 7. §12 phases → Tasks map to phases 0–3. §13 git hygiene → already done (gitignore + spec commit). No gaps.

**Placeholder scan:** UI component bodies (Tasks 6–8) describe behavior rather than full Svelte source — acceptable because they are presentational and verified manually, but the executing agent must write complete components, not stubs. All logic tasks (1–5, ICS, syncKey) have complete code.

**Type consistency:** `Session` fields are identical across Tasks 2–8. `syncKeyFor`, `generateICS`, `parseWorkbook/parseRows`, `courseColor` signatures match between definition and use. `firstOccurrence`/`untilUtc` defined in Task 4, extracted to `recurrence.ts` in Task 7 — both `generate.ts` and `calendar.ts` import from there after the move.
