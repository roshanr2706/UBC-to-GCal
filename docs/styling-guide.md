# Styling Guide — UBC to GCal

The single source of truth for the app's visual language. shadcn-svelte components are themed through the CSS variables in `src/app.css`; this guide pins what those values mean and the rules every component must follow.

## Hard rules

1. **No gradients. Ever.** No `linear-gradient`, `radial-gradient`, `conic-gradient`, or gradient utility classes. Every fill is a flat solid color. This is a non-negotiable project constraint.
2. **One accent color.** Indigo (`--primary`, `hsl(243 75% 59%)`). Used for primary buttons, focus rings, and active states only. Don't introduce competing accent hues for chrome.
3. **Neutral surfaces.** Backgrounds and cards are white/near-white; text and borders use the slate scale. Surfaces never carry the accent as a fill except for primary actions.
4. **Course colors are data, not chrome.** The 8-color course palette (below) is reserved for distinguishing courses in the preview table and calendar events. Never use it for buttons, links, or layout.

## Color tokens (HSL CSS variables, defined in `src/app.css`)

| Token | Value | Use |
|---|---|---|
| `--background` | `0 0% 100%` | page background |
| `--foreground` | `222 47% 11%` | primary text |
| `--card` | `0 0% 100%` | card surfaces |
| `--primary` | `243 75% 59%` | accent: primary buttons, focus ring |
| `--muted` | `210 40% 96%` | subtle fills |
| `--muted-foreground` | `215 16% 47%` | secondary text |
| `--destructive` | `0 72% 51%` | errors, destructive actions |
| `--border` | `214 32% 91%` | borders, dividers |
| `--ring` | `243 75% 59%` | focus outline |
| `--radius` | `0.5rem` | corner radius base |

## Course palette (flat solid hex — `src/lib/ui/colors.ts`)

Assigned in order to distinct courses; stable per course within a schedule.

`#4f46e5` · `#0891b2` · `#16a34a` · `#ca8a04` · `#dc2626` · `#9333ea` · `#db2777` · `#0d9488`

(indigo · cyan · green · amber · red · violet · pink · teal)

## Type scale

- Page title: `text-2xl font-semibold`
- Section heading: `text-lg font-medium`
- Body: `text-sm`
- Meta / captions: `text-xs text-muted-foreground`
- Font: system UI stack (Tailwind default `font-sans`).

## Spacing & layout

- Base unit: Tailwind's 4px scale. Prefer `gap-4` / `p-4` / `space-y-4` for rhythm.
- Page container: `container py-10` (max-width 1100px, centered, 1rem gutters).
- Cards: `rounded-lg border p-4` (or `p-6` for primary panels). One level of shadow max (`shadow-sm`); no heavy shadows.

## Component conventions

- **Buttons:** primary = solid indigo; secondary = `secondary` (slate); destructive = `destructive`. Outline/ghost for tertiary. Never gradient-filled.
- **Flag/status badges:** `not-registered` → muted/secondary; `no-meeting-time` → amber-tinted (use course-amber sparingly, or muted); `parse-error` → destructive. Always pair color with a text label (accessibility — never color alone).
- **Tables:** zebra rows via `--muted` at low emphasis; excluded/flagged rows dimmed with `opacity-60`.
- **Focus:** always show the `--ring` focus outline; never remove focus styles.

## Responsiveness

- Mobile-first. The preview table collapses to stacked cards below `sm` (640px).
- Tap targets ≥ 40px high on mobile. Action bar wraps rather than horizontally scrolling.
