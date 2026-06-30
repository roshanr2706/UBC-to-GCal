import { describe, it, expect } from 'vitest';
import { utils } from 'xlsx';
import { parseRows, fixRange } from './workbook';

type Cell = string | number | Date | null;

const HEADER: Cell[] = [
  null,
  'Course Listing',
  'Drop',
  'Swap',
  'Credits',
  'Grading Basis',
  'Section',
  'Registration Status',
  'Instructional Format',
  'Delivery Mode',
  'Meeting Patterns',
  'Instructor',
  'Start Date',
  'End Date'
];

const DESC = (course: string, term: string) =>
  `Roshan Ramchandani (82418484) - Faculty of Science - 2025-06-19 - Active - ${course} - Title - ${term} (UBC-V)`;

function rowsWith(...data: Cell[][]): Cell[][] {
  return [
    ['My Enrolled Courses'],
    [null, null, null, null, null, null, 'Enrolled Sections'],
    HEADER,
    ...data
  ];
}

describe('parseRows', () => {
  it('parses a single-block Term 1 lecture', () => {
    const rows = rowsWith([
      DESC('CPSC_V 320', '2026-27 Winter Term 1'),
      'CPSC_V 320 - Intermediate Algorithm Design and Analysis',
      null,
      null,
      3,
      'Graded',
      'CPSC_V 320-101 - x',
      'Registered',
      'Lecture',
      'In Person Learning',
      '2026-09-09 - 2026-12-07 | Mon Wed Fri | 3:00 p.m. - 4:00 p.m. | UBCV | West Mall Swing Space Building (SWNG) | Floor: 2 | Room: 222',
      null,
      null,
      null
    ]);
    const s = parseRows(rows);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      courseCode: 'CPSC_V 320',
      section: '101',
      component: 'Lecture',
      days: ['MO', 'WE', 'FR'],
      startTime: '15:00',
      endTime: '16:00',
      rangeStart: '2026-09-09',
      rangeEnd: '2026-12-07',
      location: 'SWNG 222',
      term: '2026-27 Winter Term 1',
      status: 'Registered',
      included: true,
      flags: []
    });
  });

  it('splits a Term 2 two-block lecture into two sessions', () => {
    const rows = rowsWith([
      DESC('CPSC_V 317', '2026-27 Winter Term 2'),
      'CPSC_V 317 - Introduction to Computer Networking',
      null,
      null,
      3,
      'Graded',
      'CPSC_V 317-202 - x',
      'Registered',
      'Lecture',
      'In Person Learning',
      '2027-01-06 - 2027-02-12 | Mon Wed Fri | 11:00 a.m. - 12:00 p.m. | UBCV | HR MacMillan Building (MCML) | Floor: 3 | Room: 360\n\n2027-02-22 - 2027-04-12 | Mon Wed Fri | 11:00 a.m. - 12:00 p.m. | UBCV | HR MacMillan Building (MCML) | Floor: 3 | Room: 360',
      null,
      null,
      null
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
      'CPSC_V 310 - Introduction to Software Engineering',
      null,
      null,
      4,
      'Graded',
      'CPSC_V 310-L1M - x',
      'Registered',
      'Laboratory',
      'In Person Learning',
      '2026-09-14 - 2026-12-07 | Mon | 11:00 a.m. - 1:00 p.m. |',
      null,
      null,
      null
    ]);
    const s = parseRows(rows);
    expect(s[0].location).toBeNull();
    expect(s[0].component).toBe('Laboratory');
    expect(s[0].included).toBe(true);
  });

  it('flags and excludes a non-registered row', () => {
    const rows = rowsWith([
      DESC('CPSC_V 999', '2026-27 Winter Term 1'),
      'CPSC_V 999 - x',
      null,
      null,
      3,
      'Graded',
      'CPSC_V 999-101 - x',
      'Waitlisted',
      'Lecture',
      'In Person Learning',
      '2026-09-09 - 2026-12-07 | Mon | 9:00 a.m. - 10:00 a.m. |',
      null,
      null,
      null
    ]);
    const s = parseRows(rows);
    expect(s[0].included).toBe(false);
    expect(s[0].flags).toContain('not-registered');
  });

  it('flags an async row with no meeting pattern', () => {
    const rows = rowsWith([
      DESC('CPSC_V 555', '2026-27 Winter Term 1'),
      'CPSC_V 555 - x',
      null,
      null,
      3,
      'Graded',
      'CPSC_V 555-101 - x',
      'Registered',
      'Lecture',
      'Online',
      '',
      null,
      null,
      null
    ]);
    const s = parseRows(rows);
    expect(s[0].flags).toContain('no-meeting-time');
    expect(s[0].included).toBe(false);
  });
});

describe('fixRange (Workday truncated-dimension quirk)', () => {
  it('recomputes "!ref" from the actual cells when it is truncated to A1', () => {
    // The real Workday export keeps all cells but reports "!ref": "A1",
    // which makes SheetJS read only the first cell.
    const sheet = utils.aoa_to_sheet([
      ['My Enrolled Courses'],
      [null, null, null, null, null, null, 'Enrolled Sections'],
      HEADER
    ]) as Record<string, unknown>;
    sheet['!ref'] = 'A1';
    fixRange(sheet);
    // HEADER spans columns A..N (0..13) across rows 1..3 (0-indexed 0..2).
    expect(sheet['!ref']).toBe('A1:N3');
  });
});
