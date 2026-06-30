<script lang="ts">
  import { cn } from '$lib/utils';
  import { toasts, dismissToast, type ToastKind } from './toast';

  // Flat solid fills only.
  const styles: Record<ToastKind, string> = {
    success: 'bg-primary text-primary-foreground',
    error: 'bg-destructive text-destructive-foreground',
    info: 'bg-secondary text-secondary-foreground'
  };
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
  {#each $toasts as t (t.id)}
    <button
      class={cn('rounded-md px-4 py-3 text-sm shadow-sm text-left max-w-sm', styles[t.kind])}
      onclick={() => dismissToast(t.id)}
    >
      {t.message}
    </button>
  {/each}
</div>
