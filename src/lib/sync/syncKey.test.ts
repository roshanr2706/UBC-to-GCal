import { describe, it, expect } from 'vitest';
import { syncKeyFor } from './syncKey';
import type { Session } from '$lib/parser/types';

const base: Session = {
  courseCode: 'CPSC_V 317',
  title: '',
  section: '202',
  component: 'Lecture',
  deliveryMode: '',
  days: ['MO', 'WE', 'FR'],
  startTime: '11:00',
  endTime: '12:00',
  rangeStart: '2027-01-06',
  rangeEnd: '2027-02-12',
  location: null,
  instructor: null,
  term: 'T2',
  status: 'Registered',
  included: true,
  flags: []
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
  it('differs across section', () => {
    expect(syncKeyFor(base)).not.toBe(syncKeyFor({ ...base, section: '203' }));
  });
});
