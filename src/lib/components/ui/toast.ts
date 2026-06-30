import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export const toasts = writable<Toast[]>([]);
let nextId = 1;

export function pushToast(kind: ToastKind, message: string, ttl = 5000): number {
  const id = nextId++;
  toasts.update((list) => [...list, { id, kind, message }]);
  if (ttl > 0 && typeof window !== 'undefined') {
    setTimeout(() => dismissToast(id), ttl);
  }
  return id;
}

export function dismissToast(id: number): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}

export const toast = {
  success: (m: string) => pushToast('success', m),
  error: (m: string) => pushToast('error', m),
  info: (m: string) => pushToast('info', m)
};
