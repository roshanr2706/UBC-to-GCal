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
      const calendarId = await ensureCalendar(token, term);
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
  <Button variant="outline" disabled title="Set PUBLIC_GOOGLE_CLIENT_ID in .env to enable">
    Sync to Google (not configured)
  </Button>
{:else if !token}
  <Button variant="outline" onclick={signIn} disabled={busy}>
    {busy ? 'Opening Google…' : 'Sign in with Google'}
  </Button>
{:else}
  <Button variant="default" onclick={sync} disabled={busy}>
    {busy ? 'Syncing…' : `Sync ${includable.length} to "UBC Courses ${term}"`}
  </Button>
{/if}
