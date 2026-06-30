import { DateTime } from 'luxon';

export const VANCOUVER = 'America/Vancouver';

export const DOW: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7
};

/** The first calendar day on/after `rangeStart` that falls on one of `days`. */
export function firstOccurrence(rangeStart: string, days: string[]): DateTime {
  const start = DateTime.fromISO(rangeStart, { zone: VANCOUVER });
  const wanted = days.map((d) => DOW[d]).filter(Boolean);
  for (let i = 0; i < 7; i++) {
    const cand = start.plus({ days: i });
    if (wanted.includes(cand.weekday)) return cand;
  }
  return start;
}

/** Inclusive end-of-day in Vancouver for `rangeEnd`, formatted as a UTC RRULE UNTIL. */
export function untilUtc(rangeEnd: string): string {
  return DateTime.fromISO(rangeEnd, { zone: VANCOUVER })
    .endOf('day')
    .toUTC()
    .toFormat("yyyyMMdd'T'HHmmss'Z'");
}
