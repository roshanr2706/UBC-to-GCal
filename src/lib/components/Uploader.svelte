<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { parseWorkbook } from '$lib/parser/workbook';
  import { sessions } from '$lib/stores/sessions';
  import { toast } from '$lib/components/ui/toast';

  let dragging = $state(false);
  let fileInput: HTMLInputElement;

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error('Please upload the .xlsx file exported from Workday.');
      return;
    }
    try {
      // Parsed entirely in the browser — the file never leaves this device.
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      sessions.set(parsed);
      const usable = parsed.filter((s) => s.flags.length === 0).length;
      if (parsed.length === 0) {
        toast.error('No course rows found. Is this the "View My Courses" export?');
      } else {
        toast.success(`Parsed ${parsed.length} session(s) — ${usable} ready to add.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    handleFile(e.dataTransfer?.files?.[0]);
  }
</script>

<Card class="p-6">
  <div
    role="button"
    tabindex="0"
    class="flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-8 text-center transition-colors {dragging
      ? 'border-primary bg-muted'
      : 'border-input'}"
    ondragover={(e) => {
      e.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={onDrop}
    onclick={() => fileInput.click()}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.click()}
  >
    <p class="text-sm font-medium">Drop your <code>View_My_Courses.xlsx</code> here</p>
    <p class="text-xs text-muted-foreground">
      Workday → Academics → Registration &amp; Courses → gear icon → Download to Excel
    </p>
    <Button variant="default" size="sm">Choose file</Button>
    <p class="text-xs text-muted-foreground">Your file is read in your browser and never uploaded.</p>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept=".xlsx,.xls"
    class="hidden"
    onchange={(e) => handleFile((e.currentTarget as HTMLInputElement).files?.[0])}
  />
</Card>
