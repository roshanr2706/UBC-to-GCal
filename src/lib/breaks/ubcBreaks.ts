import { DateTime } from 'luxon';
import { DOW, VANCOUVER } from '$lib/ics/recurrence';

export interface NoClassDate {
  date: string; // ISO YYYY-MM-DD
  label: string;
}

// UBC Vancouver 2026/27 Winter Session dates where lectures and labs are
// cancelled or the University is closed. Source (official):
// https://vancouver.calendar.ubc.ca/dates-and-deadlines
//
// These follow the STANDARD term schedule. Programs on non-standard schedules
// (e.g. Medicine, Dentistry, some professional/co-op terms) may differ — the UI
// tells students to review and edit these exclusions themselves.
export const UBC_NO_CLASS_DATES: NoClassDate[] = [
  // Winter Term 1 (Sep 8 – Dec 7, 2026)
  { date: '2026-10-12', label: 'Thanksgiving' },
  { date: '2026-11-09', label: 'Term 1 midterm break' },
  { date: '2026-11-10', label: 'Term 1 midterm break' },
  { date: '2026-11-11', label: 'Remembrance Day' },
  // Winter Term 2 (Jan 5 – Apr 12, 2027)
  { date: '2027-02-15', label: 'Family Day / Term 2 midterm break' },
  { date: '2027-02-16', label: 'Term 2 midterm break' },
  { date: '2027-02-17', label: 'Term 2 midterm break' },
  { date: '2027-02-18', label: 'Term 2 midterm break' },
  { date: '2027-02-19', label: 'Term 2 midterm break' },
  { date: '2027-03-26', label: 'Good Friday' },
  { date: '2027-03-29', label: 'Easter Monday' }
];

/**
 * No-class dates that fall inside [rangeStart, rangeEnd] on one of `days`.
 * These correspond to weekly occurrences that should be cancelled via EXDATE.
 */
export function noClassDatesInRange(rangeStart: string, rangeEnd: string, days: string[]): string[] {
  const wanted = new Set(days.map((d) => DOW[d]).filter(Boolean));
  const start = DateTime.fromISO(rangeStart, { zone: VANCOUVER });
  const end = DateTime.fromISO(rangeEnd, { zone: VANCOUVER });
  return UBC_NO_CLASS_DATES.filter((n) => {
    const d = DateTime.fromISO(n.date, { zone: VANCOUVER });
    return d >= start && d <= end && wanted.has(d.weekday);
  }).map((n) => n.date);
}
