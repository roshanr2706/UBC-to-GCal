<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import { sessions } from '$lib/stores/sessions';
  import { prefs } from '$lib/stores/prefs';
  import { toast } from '$lib/components/ui/toast';
  import { requestToken, hasClientId } from '$lib/google/auth';
  import { ensureCalendar, syncSessions } from '$lib/google/calendar';

  let token = $state<string | null>(null);
  let busy = $state(false);
  let configured = hasClientId();

  let includable = $derived($sessions.filter((s) => s.included && s.flags.length === 0));
  let term = $derived(includable[0]?.term ?? '');

  async function signIn() {
    busy = true;
    try {
      token = await requestToken();
      toast.success('Signed in to Google.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      busy = false;
    }
  }

  async function sync() {
    if (!token) return;
    if (includable.length === 0) {
      toast.error('Select at least one session to sync.');
      return;
    }
    busy = true;
    try {
      const calendarId =
        $prefs.destinationMode === 'existing' ? 'primary' : await ensureCalendar(token, term);
      prefs.update((p) => ({ ...p, lastCalendarId: calendarId }));
      const result = await syncSessions(token, calendarId, $sessions);
      toast.success(`Synced: ${result.inserted} added, ${result.patched} updated.`);
      if (result.orphans.length > 0) {
        toast.info(
          `${result.orphans.length} previously-synced event(s) look dropped — delete them in Google Calendar: ${result.orphans.join(', ')}`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      busy = false;
    }
  }
</script>

{#if !configured}
  <!-- Google sync is optional; render nothing when no client ID is configured. -->
{:else if !token}
  <Button variant="outline" onclick={signIn} disabled={busy}>
    {busy ? 'Opening Google…' : 'Sign in with Google'}
  </Button>
{:else}
  <div class="flex flex-wrap items-center gap-3">
    <Button variant="default" onclick={sync} disabled={busy}>
      {#if busy}
        Syncing…
      {:else if $prefs.destinationMode === 'existing'}
        Sync {includable.length} to your primary calendar
      {:else}
        Sync {includable.length} to "UBC Courses {term}"
      {/if}
    </Button>
    <label class="flex items-center gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        class="h-4 w-4 rounded border-input accent-primary"
        checked={$prefs.destinationMode === 'existing'}
        onchange={(e) =>
          prefs.update((p) => ({
            ...p,
            destinationMode: (e.currentTarget as HTMLInputElement).checked ? 'existing' : 'dedicated'
          }))}
      />
      Use my primary calendar instead of a dedicated one
    </label>
  </div>
{/if}
