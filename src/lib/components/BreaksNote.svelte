<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { UBC_NO_CLASS_DATES } from '$lib/breaks/ubcBreaks';
  import { DateTime } from 'luxon';

  // Group consecutive/related dates by label for a compact summary.
  const grouped = Object.entries(
    UBC_NO_CLASS_DATES.reduce<Record<string, string[]>>((acc, d) => {
      (acc[d.label] ??= []).push(d.date);
      return acc;
    }, {})
  ).map(([label, dates]) => {
    const fmt = (iso: string) => DateTime.fromISO(iso).toFormat('MMM d');
    const range =
      dates.length === 1
        ? fmt(dates[0])
        : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}, ${DateTime.fromISO(dates[0]).year}`;
    return { label, range };
  });
</script>

<Card class="border-l-4 border-l-primary p-4">
  <p class="text-sm font-medium">UBC breaks &amp; holidays are handled for you</p>
  <p class="mt-1 text-sm text-muted-foreground">
    Individual class meetings that fall on the standard <strong>2026/27 Winter Session</strong> breaks
    and statutory holidays are automatically skipped in both the <code>.ics</code> file and Google Calendar
    sync, so you won't get reminders for classes that aren't running. Dates are from the official
    <a
      class="underline"
      href="https://vancouver.calendar.ubc.ca/dates-and-deadlines"
      target="_blank"
      rel="noopener noreferrer">UBC Academic Calendar</a
    >.
  </p>

  <ul class="mt-3 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
    {#each grouped as g}
      <li class="flex justify-between gap-3">
        <span>{g.label}</span>
        <span class="whitespace-nowrap tabular-nums">{g.range}</span>
      </li>
    {/each}
  </ul>

  <p class="mt-3 text-xs text-muted-foreground">
    <strong>On a non-standard schedule?</strong> Programs like Medicine, Dentistry, and some
    professional, co-op, or accelerated terms don't always follow these dates. Always verify your
    section's meeting dates in Workday, and edit or delete these skipped days in your own calendar if
    yours differ.
  </p>
</Card>
