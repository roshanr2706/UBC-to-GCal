import { DateTime } from 'luxon';
import type { Session } from '$lib/parser/types';
import { syncKeyFor } from '$lib/sync/syncKey';
import { VANCOUVER_VTIMEZONE } from './vtimezone';
import { firstOccurrence, untilUtc } from './recurrence';

/** RFC5545 75-octet line folding. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let s = line;
  chunks.push(s.slice(0, 75));
  s = s.slice(75);
  while (s.length > 74) {
    chunks.push(' ' + s.slice(0, 74));
    s = s.slice(74);
  }
  if (s) chunks.push(' ' + s);
  return chunks.join('\r\n');
}

function esc(t: string): string {
  return t
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
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
  ]
    .filter(Boolean)
    .join('\\n');

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
