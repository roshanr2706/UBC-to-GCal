// Flat solid colors only — no gradients (styling guide).
// indigo · cyan · green · amber · red · violet · pink · teal
export const COURSE_PALETTE = [
  '#4f46e5',
  '#0891b2',
  '#16a34a',
  '#ca8a04',
  '#dc2626',
  '#9333ea',
  '#db2777',
  '#0d9488'
];

export function courseColor(code: string, allCodes: string[]): string {
  const unique = Array.from(new Set(allCodes));
  const idx = unique.indexOf(code);
  return COURSE_PALETTE[(idx < 0 ? 0 : idx) % COURSE_PALETTE.length];
}
