function startOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Calendar days until due: positive = future, 0 = today, negative = overdue. */
export function calendarDaysDelta(dueAt: number): number {
  const t = startOfDayMs(new Date());
  const d = startOfDayMs(new Date(dueAt));
  return Math.round((d - t) / 86400000);
}

export function formatDueDateLong(dueAt: number): string {
  return new Date(dueAt).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dueStatusPhrase(dueAt: number): string {
  const d = calendarDaysDelta(dueAt);
  if (d < 0) {
    const n = Math.abs(d);
    return `Overdue by ${n} day${n === 1 ? '' : 's'}`;
  }
  if (d === 0) return 'Due today';
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
}

/** Short label for details row: calendar days until due. */
export function formatDaysLeftValue(dueAt: number | undefined): string {
  if (dueAt == null) return '—';
  const d = calendarDaysDelta(dueAt);
  if (d < 0) {
    const n = Math.abs(d);
    return `${n} day${n === 1 ? '' : 's'} overdue`;
  }
  if (d === 0) return 'Due today';
  return `${d} day${d === 1 ? '' : 's'} left`;
}

/** End of local calendar day for a picked date (matches note list due semantics). */
export function endOfDueDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}
