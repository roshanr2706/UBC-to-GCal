import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const KEY = 'ubc-to-gcal:theme';

function initial(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export const theme = writable<Theme>(initial());

theme.subscribe((value) => {
  if (typeof window === 'undefined') return;
  try {
    document.documentElement.classList.toggle('dark', value === 'dark');
    window.localStorage.setItem(KEY, value);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
});

export function toggleTheme() {
  theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
}
