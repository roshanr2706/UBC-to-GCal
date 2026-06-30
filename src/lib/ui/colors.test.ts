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
  it('falls back to first color for unknown course', () => {
    expect(courseColor('UNKNOWN', codes)).toBe(COURSE_PALETTE[0]);
  });
});
