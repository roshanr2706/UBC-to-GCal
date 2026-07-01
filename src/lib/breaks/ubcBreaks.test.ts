import { describe, it, expect } from 'vitest';
import { noClassDatesInRange, UBC_NO_CLASS_DATES } from './ubcBreaks';

describe('noClassDatesInRange', () => {
  it('excludes Term-1 Mon/Wed/Fri holidays inside the range', () => {
    // CPSC 320 lecture: MWF, 2026-09-09 .. 2026-12-07
    const dates = noClassDatesInRange('2026-09-09', '2026-12-07', ['MO', 'WE', 'FR']);
    expect(dates).toContain('2026-10-12'); // Thanksgiving (Mon)
    expect(dates).toContain('2026-11-09'); // midterm break (Mon)
    expect(dates).toContain('2026-11-11'); // Remembrance Day (Wed)
    expect(dates).not.toContain('2026-11-10'); // Tue — not an MWF class day
  });

  it('does not exclude dates outside the weekday set', () => {
    // A Tuesday/Thursday course is unaffected by the Monday Thanksgiving.
    const dates = noClassDatesInRange('2026-09-08', '2026-12-07', ['TU', 'TH']);
    expect(dates).not.toContain('2026-10-12');
  });

  it('excludes Term-2 Good Friday and Easter Monday within the second block', () => {
    const fri = noClassDatesInRange('2027-02-22', '2027-04-12', ['MO', 'WE', 'FR']);
    expect(fri).toContain('2027-03-26'); // Good Friday (Fri)
    expect(fri).toContain('2027-03-29'); // Easter Monday (Mon)
  });

  it('returns nothing for a range with no listed breaks', () => {
    expect(noClassDatesInRange('2026-09-09', '2026-10-01', ['MO', 'WE', 'FR'])).toEqual([]);
  });

  it('every listed date has a human label', () => {
    for (const d of UBC_NO_CLASS_DATES) {
      expect(d.label.length).toBeGreaterThan(0);
    }
  });
});
