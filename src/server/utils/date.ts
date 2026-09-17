/**
 * Date and Time utilities for Genius Consultancy
 * Timezone: Asia/Kolkata (IST, UTC+5:30)
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

export function getNowIST(): Date {
  return new Date();
}

export function formatISTDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatISTDateOnly(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function getStartAndEndOfDayIST(dateStr?: string): { start: Date; end: Date } {
  const base = dateStr ? new Date(dateStr) : new Date();

  // Format as YYYY-MM-DD in IST
  const dateFormatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);

  const start = new Date(`${dateFormatted}T00:00:00.000+05:30`);
  const end = new Date(`${dateFormatted}T23:59:59.999+05:30`);

  return { start, end };
}
