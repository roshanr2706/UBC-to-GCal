import { describe, it, expect } from 'vitest';
import { eventFromSession } from './calendar';
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
  instructor: 'Jane Smith',
  term: '2026-27 Winter Term 1',
  status: 'Registered',
  included: true,
  flags: []
};

describe('eventFromSession', () => {
  const ev = eventFromSession(session);

  it('sets summary and location', () => {
    expect(ev.summary).toBe('CPSC_V 320 Lecture');
    expect(ev.location).toBe('SWNG 222');
  });

  it('anchors start/end to America/Vancouver at the first occurrence', () => {
    expect(ev.start).toEqual({ dateTime: '2026-09-09T15:00:00', timeZone: 'America/Vancouver' });
    expect(ev.end).toEqual({ dateTime: '2026-09-09T16:00:00', timeZone: 'America/Vancouver' });
  });

  it('builds a weekly RRULE plus an EXDATE for UBC breaks', () => {
    expect(ev.recurrence[0]).toMatch(/^RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=\d{8}T\d{6}Z$/);
    const exdate = ev.recurrence.find((r) => r.startsWith('EXDATE'));
    expect(exdate).toBeDefined();
    expect(exdate).toContain('20261012T150000'); // Thanksgiving
    expect(exdate).toContain('20261111T150000'); // Remembrance Day
  });

  it('tags the event with a private syncKey', () => {
    expect(ev.extendedProperties.private.syncKey).toMatch(/^ubc-[0-9a-f]{8}$/);
  });

  it('includes section, instructor and term in the description', () => {
    expect(ev.description).toContain('Section 101');
    expect(ev.description).toContain('Jane Smith');
    expect(ev.description).toContain('2026-27 Winter Term 1');
  });
});
