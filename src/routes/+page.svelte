<script lang="ts">
  import Uploader from '$lib/components/Uploader.svelte';
  import PreviewTable from '$lib/components/PreviewTable.svelte';
  import BreaksNote from '$lib/components/BreaksNote.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toaster from '$lib/components/ui/Toaster.svelte';
  import SyncPanel from '$lib/components/SyncPanel.svelte';
  import { theme, toggleTheme } from '$lib/stores/theme';
  import { sessions } from '$lib/stores/sessions';
  import { generateICS } from '$lib/ics/generate';
  import { downloadICS } from '$lib/ics/download';
  import { toast } from '$lib/components/ui/toast';

  let includedCount = $derived($sessions.filter((s) => s.included && s.flags.length === 0).length);

  function download() {
    if (includedCount === 0) {
      toast.error('Select at least one session to include.');
      return;
    }
    const ics = generateICS($sessions);
    downloadICS(ics, 'ubc-schedule.ics');
    toast.success(`Downloaded ${includedCount} event(s) as ubc-schedule.ics`);
  }
</script>

<main class="container max-w-5xl space-y-8 py-10">
  <header class="flex items-start justify-between gap-4">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold">UBC Schedule → Google Calendar</h1>
      <p class="text-sm text-muted-foreground">
        Turn your Workday course export into calendar events. Download an <code>.ics</code> file or sync
        directly to Google Calendar. Everything runs in your browser.
      </p>
    </div>
    <Button
      variant="ghost"
      size="icon"
      class="shrink-0"
      onclick={toggleTheme}
      aria-label="Toggle dark mode"
      title={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {#if $theme === 'dark'}
        <!-- sun -->
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      {:else}
        <!-- moon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      {/if}
    </Button>
  </header>

  <Uploader />

  <PreviewTable />

  {#if $sessions.length > 0}
    <BreaksNote />

    <div class="flex flex-wrap items-center gap-3 border-t pt-6">
      <Button onclick={download} disabled={includedCount === 0}>
        Download .ics ({includedCount})
      </Button>
      <SyncPanel />
    </div>
  {/if}
</main>

<Toaster />
