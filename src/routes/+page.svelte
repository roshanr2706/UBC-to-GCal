<script lang="ts">
  import Uploader from '$lib/components/Uploader.svelte';
  import PreviewTable from '$lib/components/PreviewTable.svelte';
  import BreaksNote from '$lib/components/BreaksNote.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toaster from '$lib/components/ui/Toaster.svelte';
  import SyncPanel from '$lib/components/SyncPanel.svelte';
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
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold">UBC Schedule → Google Calendar</h1>
    <p class="text-sm text-muted-foreground">
      Turn your Workday course export into calendar events. Download an <code>.ics</code> file or sync
      directly to Google Calendar. Everything runs in your browser.
    </p>
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
