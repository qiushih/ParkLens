import type { Weekday } from '../data/types';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Minutes since midnight → "5:00 p.m." (Canadian style). */
export function formatTime(minuteOfDay: number): string {
  const minute = ((minuteOfDay % 1440) + 1440) % 1440;
  const hour24 = Math.floor(minute / 60);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12)}:${String(minute % 60).padStart(2, '0')} ${hour24 < 12 ? 'a.m.' : 'p.m.'}`;
}

/** "Sat 3:00 a.m." */
export function formatDayTime(day: Weekday, minuteOfDay: number): string {
  return `${WEEKDAY_SHORT[day]} ${formatTime(minuteOfDay)}`;
}

/** 30 → "30 min", 120 → "2 hr", 90 → "1 hr 30 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0 ? `${String(hours)} hr` : `${String(hours)} hr ${String(rest)} min`;
}

/** "2026-09-14" → "Sep 2026". */
export function formatMonthYear(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
