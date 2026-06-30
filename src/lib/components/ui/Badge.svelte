<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Snippet } from 'svelte';

  type Variant = 'default' | 'secondary' | 'destructive' | 'warning';
  let {
    variant = 'default',
    class: className = '',
    children
  }: { variant?: Variant; class?: string; children: Snippet } = $props();

  // Flat solid fills only.
  const variants: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    warning: 'bg-amber-500 text-white'
  };
</script>

<span
  class={cn(
    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
    variants[variant],
    className
  )}
>
  {@render children()}
</span>
