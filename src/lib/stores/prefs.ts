import { writable } from 'svelte/store';

export interface Prefs {
  lastCalendarId: string | null;
  destinationMode: 'dedicated' | 'existing';
}

const DEFAULTS: Prefs = { lastCalendarId: null, destinationMode: 'dedicated' };
const KEY = 'ubc-to-gcal:prefs';

function load(): Prefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export const prefs = writable<Prefs>(load());

prefs.subscribe((value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
});
