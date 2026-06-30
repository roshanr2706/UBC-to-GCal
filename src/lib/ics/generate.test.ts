import { describe, it, expect } from 'vitest';
import { generateICS } from './generate';
import type { Session } from '$lib/parser/types';

const session: Session = {
  courseCode: 'CPSC_V 320',
  title: 'Intermediate Algorithm Design and Analysis',
  section: '101',
  component: 'Lecture',
  deliveryMode: 'In Person Learning',
  days: ['MO', 'WE', 'FR'],
  startTime: '15:00',
  endTime: '16:00',
  rangeStart: '2026-09-09',
  rangeEnd: '2026-12-07',
  location: 'SWNG 222',
  instructor: null,
  term: '2026-27 Winter Term 1',
  status: 'Registered',
  included: true,
  flags: []
};

describe('generateICS', () => {
  const ics = generateICS([session]);

  it('includes VCALENDAR + Vancouver VTIMEZONE', () => {
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('TZID:America/Vancouver');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('anchors DTSTART/DTEND to the named zone at the first occurrence', () => {
    // 2026-09-09 is a Wednesday → first Mon/Wed/Fri occurrence is that day.
    expect(ics).toContain('DTSTART;TZID=America/Vancouver:20260909T150000');
    expect(ics).toContain('DTEND;TZID=America/Vancouver:20260909T160000');
  });

  it('emits a weekly RRULE on the right days', () => {
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=');
  });

  it('uses CRLF line endings', () => {
    expect(ics).toContain('\r\n');
  });

  it('skips excluded or flagged sessions', () => {
    expect(generateICS([{ ...session, included: false }])).not.toContain('BEGIN:VEVENT');
    expect(generateICS([{ ...session, flags: ['parse-error'] }])).not.toContain('BEGIN:VEVENT');
  });

  it('emits one VEVENT per included session', () => {
    const two = generateICS([session, { ...session, rangeStart: '2026-09-10' }]);
    expect(two.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
