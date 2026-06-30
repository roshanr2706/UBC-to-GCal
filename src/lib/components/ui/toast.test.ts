import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { toasts, pushToast, dismissToast } from './toast';

describe('toast store', () => {
  beforeEach(() => toasts.set([]));

  it('pushes and dismisses', () => {
    const id = pushToast('success', 'hello', 0);
    expect(get(toasts)).toHaveLength(1);
    expect(get(toasts)[0]).toMatchObject({ kind: 'success', message: 'hello' });
    dismissToast(id);
    expect(get(toasts)).toHaveLength(0);
  });
});
