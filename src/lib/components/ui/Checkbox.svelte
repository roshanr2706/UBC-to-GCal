<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    checked = $bindable(false),
    class: className = '',
    ...rest
  }: { checked?: boolean; class?: string; [key: string]: unknown } = $props();
</script>

<input
  type="checkbox"
  bind:checked
  class={cn(
    'h-4 w-4 shrink-0 rounded border border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className
  )}
  {...rest}
/>
