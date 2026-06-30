import { describe, it, expect } from 'vitest';
import {
  parseDayTokens,
  parseTimeRange,
  parseDateRange,
  parseLocation,
  parseSectionCode,
  parseCourseListing,
  parseTermFromDescriptor
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
    expect(parseTimeRange('12:00 a.m. - 1:00 a.m.')).toEqual({ startTime: '00:00', endTime: '01:00' });
  });
});

describe('parseDateRange', () => {
  it('splits ISO range', () => {
    expect(parseDateRange('2026-09-09 - 2026-12-07')).toEqual({
      rangeStart: '2026-09-09',
      rangeEnd: '2026-12-07'
    });
  });
});

describe('parseLocation', () => {
  it('builds compact code+room', () => {
    expect(
      parseLocation(['UBCV', 'West Mall Swing Space Building (SWNG)', 'Floor: 2', 'Room: 222'])
    ).toBe('SWNG 222');
  });
  it('returns null when absent', () => {
    expect(parseLocation([])).toBeNull();
    expect(parseLocation([''])).toBeNull();
  });
  it('falls back to joined parts when no code/room', () => {
    expect(parseLocation(['UBCV', 'Somewhere Hall'])).toBe('UBCV, Somewhere Hall');
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
    expect(parseCourseListing('CPSC_V 320 - Intermediate Algorithm Design and Analysis')).toEqual({
      courseCode: 'CPSC_V 320',
      title: 'Intermediate Algorithm Design and Analysis'
    });
  });
});

describe('parseTermFromDescriptor', () => {
  it('extracts the term', () => {
    const s =
      'Roshan Ramchandani (82418484) - Faculty of Science (Vancouver)/Undergraduate (B.Sc.) - 2025-06-19 - Active - CPSC_V 320 - Intermediate Algorithm Design and Analysis - 2026-27 Winter Term 1 (UBC-V)';
    expect(parseTermFromDescriptor(s)).toBe('2026-27 Winter Term 1');
  });
});
