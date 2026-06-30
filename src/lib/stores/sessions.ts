import { writable } from 'svelte/store';
import type { Session } from '$lib/parser/types';

export const sessions = writable<Session[]>([]);

export function toggleInclude(index: number): void {
  sessions.update((list) =>
    list.map((s, i) => (i === index ? { ...s, included: !s.included } : s))
  );
}

export function setAllIncluded(value: boolean): void {
  sessions.update((list) =>
    list.map((s) => (s.flags.length === 0 ? { ...s, included: value } : s))
  );
}
