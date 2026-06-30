<script lang="ts">
  import Checkbox from '$lib/components/ui/Checkbox.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { sessions, toggleInclude, setAllIncluded } from '$lib/stores/sessions';
  import { courseColor } from '$lib/ui/colors';
  import type { Session } from '$lib/parser/types';

  const DAY_LABEL: Record<string, string> = {
    MO: 'Mon',
    TU: 'Tue',
    WE: 'Wed',
    TH: 'Thu',
    FR: 'Fri',
    SA: 'Sat',
    SU: 'Sun'
  };

  const FLAG_META: Record<string, { label: string; variant: 'secondary' | 'warning' | 'destructive' }> = {
    'not-registered': { label: 'Not registered', variant: 'secondary' },
    'no-meeting-time': { label: 'No fixed meeting time', variant: 'warning' },
    'parse-error': { label: "Couldn't parse", variant: 'destructive' }
  };

  let codes = $derived($sessions.map((s) => s.courseCode));
  let usableCount = $derived($sessions.filter((s) => s.flags.length === 0).length);

  function days(s: Session) {
    return s.days.map((d) => DAY_LABEL[d] ?? d).join(' ');
  }
  function time(s: Session) {
    return s.startTime ? `${s.startTime}–${s.endTime}` : '—';
  }
  function range(s: Session) {
    return s.rangeStart ? `${s.rangeStart} → ${s.rangeEnd}` : '—';
  }
</script>

{#if $sessions.length === 0}
  <Card class="p-8 text-center">
    <p class="text-sm text-muted-foreground">
      No schedule loaded yet. Upload your Workday export above to see a preview here.
    </p>
  </Card>
{:else}
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-muted-foreground">
        {usableCount} of {$sessions.length} session(s) ready. Flagged rows are excluded — review them below.
      </p>
      <div class="flex gap-3 text-xs">
        <button class="underline" onclick={() => setAllIncluded(true)}>Select all</button>
        <button class="underline" onclick={() => setAllIncluded(false)}>Clear all</button>
      </div>
    </div>

    <!-- Desktop / tablet: table -->
    <Card class="hidden overflow-x-auto sm:block">
      <table class="w-full text-sm">
        <thead class="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th class="p-3 w-10"></th>
            <th class="p-3">Course</th>
            <th class="p-3">Component</th>
            <th class="p-3">Days</th>
            <th class="p-3">Time</th>
            <th class="p-3">Dates</th>
            <th class="p-3">Location</th>
            <th class="p-3">Term</th>
          </tr>
        </thead>
        <tbody>
          {#each $sessions as s, i (i)}
            <tr class="border-b last:border-0 {s.flags.length ? 'opacity-60' : ''}">
              <td class="p-3">
                <Checkbox
                  checked={s.included}
                  disabled={s.flags.length > 0}
                  onchange={() => toggleInclude(i)}
                />
              </td>
              <td class="p-3 font-medium">
                <span class="inline-flex items-center gap-2">
                  <span
                    class="inline-block h-3 w-3 rounded-sm"
                    style="background-color: {courseColor(s.courseCode, codes)}"
                  ></span>
                  {s.courseCode}
                </span>
                {#each s.flags as f}
                  <span class="ml-2"
                    ><Badge variant={FLAG_META[f]?.variant ?? 'secondary'}
                      >{FLAG_META[f]?.label ?? f}</Badge
                    ></span
                  >
                {/each}
              </td>
              <td class="p-3">{s.component}</td>
              <td class="p-3">{days(s)}</td>
              <td class="p-3">{time(s)}</td>
              <td class="p-3 whitespace-nowrap">{range(s)}</td>
              <td class="p-3">{s.location ?? '—'}</td>
              <td class="p-3 whitespace-nowrap">{s.term}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Card>

    <!-- Mobile: stacked cards -->
    <div class="space-y-2 sm:hidden">
      {#each $sessions as s, i (i)}
        <Card class="p-4 {s.flags.length ? 'opacity-60' : ''}">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2 font-medium">
              <span
                class="inline-block h-3 w-3 rounded-sm"
                style="background-color: {courseColor(s.courseCode, codes)}"
              ></span>
              {s.courseCode} · {s.component}
            </div>
            <Checkbox
              checked={s.included}
              disabled={s.flags.length > 0}
              onchange={() => toggleInclude(i)}
            />
          </div>
          <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <dt>Days</dt><dd>{days(s)}</dd>
            <dt>Time</dt><dd>{time(s)}</dd>
            <dt>Dates</dt><dd>{range(s)}</dd>
            <dt>Location</dt><dd>{s.location ?? '—'}</dd>
            <dt>Term</dt><dd>{s.term}</dd>
          </dl>
          {#each s.flags as f}
            <div class="mt-2">
              <Badge variant={FLAG_META[f]?.variant ?? 'secondary'}>{FLAG_META[f]?.label ?? f}</Badge>
            </div>
          {/each}
        </Card>
      {/each}
    </div>
  </div>
{/if}
