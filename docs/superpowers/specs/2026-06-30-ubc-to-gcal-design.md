# UBC Schedule → Google Calendar: Design Spec

**Date:** 2026-06-30
**Status:** Approved for implementation.
**Supersedes:** the inferred format assumptions in `excel-to-gcal-design-doc.md` (that doc's section 3 was guessed; this spec is validated against a real export).

---

## 1. Goal

A client-side, static webapp that parses a UBC Workday **"View My Courses"** Excel export and turns each registered section into calendar events, via two paths:

- **Download `.ics`** — no auth, public, works for anyone.
- **Sync to Google Calendar** — gated behind Google sign-in, idempotent re-sync, ships in Google "Testing" mode (allow-listed accounts).

**Scope:** Phases 0–3 (parser, ICS MVP, Google sync, polish). Audience undecided → `.ics` stays fully public; Google sync stays allow-listed; OAuth verification deferred.

## 2. Non-functional requirements

- **Privacy:** spreadsheet parsed entirely in-browser; raw file never uploaded. Column A of each row contains the student's name and **student number** — parsed only for the term label, never transmitted, never logged.
- **Timezone correctness:** all events anchored to `America/Vancouver` (named zone, not fixed offset) so DST transitions inside a term don't shift class times.
- **Graceful partial failure:** a row that fails to parse is surfaced in the preview UI; the rest of the schedule still processes.
- **Stateless hosting:** static site (`adapter-static`). Persistence is `localStorage` only.
- **No gradients** anywhere; flat solid colors per the styling guide.

## 3. Tech stack

- **SvelteKit** + `@sveltejs/adapter-static` — static output.
- **shadcn-svelte** + **Tailwind** for UI, constrained by `docs/styling-guide.md`.
- **SheetJS (`xlsx`)** — client-side workbook parsing.
- **Luxon** — timezone-aware date/time math.
- **Hand-rolled ICS generator** (not `ical-generator`) — ~100 lines emitting `DTSTART;TZID=America/Vancouver`, a static Vancouver `VTIMEZONE` block, and `RRULE`. Lighter and browser-safe; unit-testable.
- **Google Identity Services** (`google.accounts.oauth2.initTokenClient`) + plain `fetch` to Calendar API v3. No `googleapis` package.
- **TypeScript** throughout.

## 4. Real source-data format (validated)

Workbook sheet: `View My Courses`. Layout:

- Rows 1–2: banner rows (`My Enrolled Courses`, `Enrolled Sections`) — skip.
- **Row 3: header.** Columns (note column A is unlabeled):
  - A *(unlabeled)*: descriptor string — `"{Name} ({StudentNumber}) - {Faculty} - {date} - Active - {COURSE} - {Title} - {Term} (UBC-V)"`. **Source of the term label.** Contains sensitive student number.
  - B `Course Listing` — e.g. `CPSC_V 320 - Intermediate Algorithm Design and Analysis`
  - C `Drop`, D `Swap` — ignored
  - E `Credits`, F `Grading Basis`
  - G `Section` — e.g. `CPSC_V 320-T1E - Intermediate Algorithm Design and Analysis` (section code is the `T1E` / `101` / `L1M` token)
  - H `Registration Status` — e.g. `Registered`
  - I `Instructional Format` — `Lecture` | `Discussion` | `Laboratory`
  - J `Delivery Mode` — e.g. `In Person Learning`
  - K `Meeting Patterns` — composite, see below
  - L `Instructor` — separate column, often empty
  - M `Start Date`, N `End Date` — term bounds (broad; not authoritative for series timing)

**Meeting Patterns cell format (per block):**
```
2026-09-09 - 2026-12-07 | Mon Wed Fri | 3:00 p.m. - 4:00 p.m. | UBCV | West Mall Swing Space Building (SWNG) | Floor: 2 | Room: 222
```
Order: **DateRange | Days | TimeRange | Campus | Building (CODE) | Floor: N | Room: NNN**.
- Dates are ISO (`YYYY-MM-DD`), range joined by ` - `.
- Days are 3-letter tokens space-separated: `Mon Tue Wed Thu Fri Sat Sun`.
- Times are `h:mm a.m./p.m.`.
- Trailing location fields can be **absent** (e.g. a lab: `... | Mon | 11:00 a.m. - 1:00 p.m. |` with empty tail).
- **Multiple blocks** are separated by a blank line (`\n\n`). Term 2 sections export as **two blocks with the same days/time but different date ranges**, split around the February reading week. Term 1 sections export as a single block (reading week not excluded by the source — accepted as-is).

## 5. Parser

Normalized session model:
```ts
interface Session {
  courseCode: string;     // "CPSC_V 320"
  title: string;          // "Intermediate Algorithm Design and Analysis"
  section: string;        // "T1E" | "101" | "L1M"
  component: string;      // "Lecture" | "Discussion" | "Laboratory"
  deliveryMode: string;   // "In Person Learning"
  days: string[];         // RFC5545 BYDAY, e.g. ["MO","WE","FR"]
  startTime: string;      // "15:00" (24h)
  endTime: string;        // "16:00"
  rangeStart: string;     // "2026-09-09" ISO
  rangeEnd: string;       // "2026-12-07" ISO
  location: string | null;// compact "SWNG 222" or full building+room; null if absent
  instructor: string | null;
  term: string;           // "2026-27 Winter Term 1" (from column A)
  status: string;         // "Registered"
  included: boolean;      // user toggle, defaults true for Registered
  flags: string[];        // e.g. ["not-registered"], ["no-meeting-time"], ["parse-error"]
}
```

Pipeline:
1. Read first sheet via SheetJS as a 2-D array.
2. **Detect header row** by string-matching known column names (`Course Listing`, `Meeting Patterns`, `Instructional Format`, …) — do not hardcode row index.
3. Build a column-name → index map from the header (don't hardcode column order).
4. For each data row:
   - Extract term from column A (regex on the descriptor string).
   - Read status. If not `Registered` → emit a flagged, excluded-by-default placeholder session (`flags: ["not-registered"]`) so it shows in preview; do not drop.
   - Split Meeting Patterns on `\n\n` (also tolerate `\r\n\r\n`); trim blocks.
   - If no blocks / empty cell → flagged session `["no-meeting-time"]` (async/online), excluded by default.
   - For each block, parse in the real order. **One Session per block** (this yields two sessions for Term-2 split sections — correct).
   - Parse failures per block → flagged `["parse-error"]` session carrying the raw block text; continue with remaining blocks/rows.
5. Sub-parsers (each independently unit-tested):
   - `parseDateRange("2026-09-09 - 2026-12-07")` → `{rangeStart, rangeEnd}`
   - `parseDayTokens("Mon Wed Fri")` → `["MO","WE","FR"]`
   - `parseTimeRange("3:00 p.m. - 4:00 p.m.")` → `{startTime:"15:00", endTime:"16:00"}`
   - `parseLocation([campus, building, floor, room])` → compact string or `null`
   - `parseSectionCode("CPSC_V 320-T1E - …")` → `"T1E"`
   - `parseCourseListing("CPSC_V 320 - …")` → `{courseCode, title}`
   - `parseTermFromDescriptor(colA)` → term string

## 6. ICS generation

- One `VEVENT` per Session.
- `DTSTART;TZID=America/Vancouver:{rangeStart}T{startTime}00`, `DTEND` same day with `endTime`.
- `RRULE:FREQ=WEEKLY;BYDAY={days};UNTIL={rangeEnd}T235959Z` (UNTIL computed in UTC from the last in-range occurrence via Luxon, or use a Vancouver-local UNTIL with TZID-safe handling — implementation detail validated by import test).
- Calendar includes one static, standards-compliant `VTIMEZONE` block for `America/Vancouver`.
- `SUMMARY`: `{courseCode} {component}` (e.g. `CPSC_V 320 Lecture`).
- `LOCATION`: location string when present.
- `DESCRIPTION`: section, instructor, term.
- `UID`: derived from syncKey (§7) for stability across re-downloads.
- Term-2 split = two VEVENTs (correct; reading-week gap excluded naturally).

## 7. Google Calendar sync

- **syncKey** (refined from the original doc to avoid Term-2 collision):
  ```
  syncKey = hash(courseCode + section + component + days.join("") + rangeStart)
  ```
  The original `course+section+component+days` collides between Term-2's two same-day blocks; adding `rangeStart` disambiguates.
- Stored in `extendedProperties.private.syncKey` at creation.
- Per sync run, per session:
  ```
  existing = events.list(calendarId, privateExtendedProperty="syncKey="+syncKey)
  if empty: events.insert(newEvent)
  else:     events.patch(existing[0].id, updatedFields)
  ```
- **Dedicated calendar**: create `UBC Courses {term}` once via `calendars.insert`; remember its id in `localStorage`; reuse on later syncs. User may instead pick an existing calendar.
- **Orphan handling:** on re-sync, syncKeys present in the calendar (under our extendedProperty namespace) but absent from the current upload are surfaced in the UI as "dropped — delete?" rather than silently removed.
- **Auth:** GIS token client, scope `https://www.googleapis.com/auth/calendar.events` (+ `calendar` for calendar creation). Short-lived token, no backend, no refresh token. Sign-in gated behind a button; ICS path never triggers auth.

## 8. UI flow

1. **Upload** — drag-drop zone + file picker (shadcn Card + Button).
2. **Preview** — shadcn Table: one row per detected session; columns course / component / days / time / date range / location / term. Per-row include/exclude Checkbox. Flagged rows (not-registered, no-meeting-time, parse-error) visually distinguished and excluded by default with the reason shown. Empty-state when zero parseable rows.
3. **Actions** — `Download .ics` (always enabled) and `Sync to Google` (prompts sign-in). Sonner toasts for results; clear per-row error states.
4. **Polish (Phase 3):** color-coding by course (fixed palette from styling guide), mobile-responsive layout, `localStorage` for last-picked calendar + preferences.

## 9. Styling guide

Authored as `docs/styling-guide.md` and followed throughout. Pins: flat solid palette (**no gradients**), neutral surfaces + single accent, fixed per-course color set for event color-coding, type scale, spacing scale, and shadcn-svelte theme tokens (CSS variables).

## 10. Edge cases

- Multi-component course (Lecture + Discussion + Laboratory) → separate sessions/series each scoped to its own block. ✔ handled by per-block sessions.
- Term-2 reading-week split (two date ranges) → two sessions/VEVENTs. ✔
- Lab with no location (trailing empty pipes) → `location: null`. ✔
- Non-`Registered` rows → flagged, excluded by default, shown. ✔
- Fully async/no-pattern course → flagged `no-meeting-time`. ✔
- Two-term schedule (Term 1 + Term 2 rows) → distinct sessions; term carried through; calendar name uses term. ✔
- Zero parseable rows (wrong/empty file) → preview empty-state with guidance. ✔
- Re-upload after drop → orphan syncKey surfaced for deletion. ✔
- DST boundary inside a term → correct via `TZID=America/Vancouver`. ✔
- Same course/component/days legitimately differing (room/section) → syncKey includes rangeStart and section, avoiding collapse. ✔

## 11. Testing

- **Unit tests** for every sub-parser (§5) and the ICS generator, using fixtures derived from the real file: single-component Term-1 lecture, Term-2 split lecture (two blocks), lab with missing location, discussion section, and synthetic TBA / non-registered / async rows.
- **ICS import test:** generate `.ics`, import into Google Calendar, confirm event times land correctly in `America/Vancouver` including a Term-1 event and a Term-2 (post-reading-week) event.
- **Idempotency test:** simulate two sync runs; assert patch (not duplicate insert) on the second.

## 12. Build phases

0. **Parser only** — sub-parsers + normalized session list, validated against the real file via unit tests. (Blocker from original doc already resolved.)
1. **ICS MVP** — upload, preview table with include/exclude, `.ics` download. Publishable, no OAuth.
2. **Google sync** — GIS sign-in, calendar create/select, insert/patch idempotent sync, orphan surfacing. Testing mode.
3. **Polish** — color-coding, mobile-responsive, `localStorage`, refined error states.
4. *(Deferred)* Google OAuth verification, only if usage outgrows the allow-list.

## 13. Git hygiene

- `git init` in the project root.
- `.gitignore` includes `View_My_Courses.xlsx` and `excel-to-gcal-design-doc.md` — **neither the export nor the original inferred design doc is ever tracked.** This spec and the styling guide are tracked.
