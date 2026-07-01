import type { Session } from '$lib/parser/types';
import { syncKeyFor } from '$lib/sync/syncKey';
import { firstOccurrence, untilUtc, VANCOUVER } from '$lib/ics/recurrence';
import { courseColorId } from '$lib/ui/colors';
import { noClassDatesInRange } from '$lib/breaks/ubcBreaks';

const API = 'https://www.googleapis.com/calendar/v3';

export interface GoogleEvent {
  summary: string;
  location?: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  recurrence: string[];
  colorId: string;
  extendedProperties: { private: { syncKey: string; app: string } };
}

export const APP_TAG = 'ubc-to-gcal';

export function eventFromSession(s: Session): GoogleEvent {
  const first = firstOccurrence(s.rangeStart, s.days);
  const date = first.toFormat('yyyy-MM-dd');
  const descParts = [
    s.section && `Section ${s.section}`,
    s.instructor && `Instructor: ${s.instructor}`,
    s.term
  ].filter(Boolean);

  const startHHMM = s.startTime.replace(':', '');
  const exdates = noClassDatesInRange(s.rangeStart, s.rangeEnd, s.days).map(
    (d) => `${d.replace(/-/g, '')}T${startHHMM}00`
  );
  const recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${s.days.join(',')};UNTIL=${untilUtc(s.rangeEnd)}`];
  if (exdates.length) recurrence.push(`EXDATE;TZID=${VANCOUVER}:${exdates.join(',')}`);

  const ev: GoogleEvent = {
    summary: `${s.courseCode} ${s.component}`,
    description: descParts.join('\n'),
    start: { dateTime: `${date}T${s.startTime}:00`, timeZone: VANCOUVER },
    end: { dateTime: `${date}T${s.endTime}:00`, timeZone: VANCOUVER },
    recurrence,
    colorId: courseColorId(s.courseCode),
    extendedProperties: { private: { syncKey: syncKeyFor(s), app: APP_TAG } }
  };
  if (s.location) ev.location = s.location;
  return ev;
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface CalendarSummary {
  id: string;
  summary: string;
}

/** Find the dedicated "UBC Courses {term}" calendar or create it once. */
export async function ensureCalendar(token: string, term: string): Promise<string> {
  const name = `UBC Courses ${term}`.trim();
  const list = await api<{ items?: Array<{ id: string; summary: string }> }>(
    token,
    '/users/me/calendarList'
  );
  const existing = list.items?.find((c) => c.summary === name);
  if (existing) return existing.id;
  const created = await api<{ id: string }>(token, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: name, timeZone: VANCOUVER })
  });
  return created.id;
}

export async function listCalendars(token: string): Promise<CalendarSummary[]> {
  const list = await api<{ items?: CalendarSummary[] }>(token, '/users/me/calendarList');
  return (list.items ?? []).map((c) => ({ id: c.id, summary: c.summary }));
}

export interface SyncResult {
  inserted: number;
  patched: number;
  orphans: string[];
}

/** Idempotent sync: insert new events, patch existing ones (matched by syncKey). */
export async function syncSessions(
  token: string,
  calendarId: string,
  sessions: Session[]
): Promise<SyncResult> {
  const usable = sessions.filter((s) => s.included && s.flags.length === 0);
  const cal = encodeURIComponent(calendarId);
  let inserted = 0;
  let patched = 0;
  const presentKeys = new Set<string>();

  for (const s of usable) {
    const key = syncKeyFor(s);
    presentKeys.add(key);
    const event = eventFromSession(s);
    const found = await api<{ items?: Array<{ id: string }> }>(
      token,
      `/calendars/${cal}/events?privateExtendedProperty=${encodeURIComponent('syncKey=' + key)}&showDeleted=false`
    );
    if (found.items && found.items.length > 0) {
      await api(token, `/calendars/${cal}/events/${found.items[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify(event)
      });
      patched++;
    } else {
      await api(token, `/calendars/${cal}/events`, {
        method: 'POST',
        body: JSON.stringify(event)
      });
      inserted++;
    }
  }

  // Surface events we created previously whose syncKey is no longer in this upload.
  const allOurs = await api<{ items?: Array<{ extendedProperties?: { private?: { syncKey?: string } }; summary?: string }> }>(
    token,
    `/calendars/${cal}/events?privateExtendedProperty=${encodeURIComponent('app=' + APP_TAG)}&maxResults=2500`
  );
  const orphans = (allOurs.items ?? [])
    .map((e) => ({ key: e.extendedProperties?.private?.syncKey, summary: e.summary }))
    .filter((e) => e.key && !presentKeys.has(e.key))
    .map((e) => e.summary ?? e.key!) as string[];

  return { inserted, patched, orphans };
}
