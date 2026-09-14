import { clean } from './text.ts';
import type { TimeWindow, Weekday } from './types.ts';

export const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const DAY_NAMES: Readonly<Record<string, Weekday>> = {
  su: 0, sun: 0, sunday: 0, sundays: 0,
  m: 1, mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  s: 6, sat: 6, saturday: 6,
};

/** "HH:MM" → minutes since midnight. */
export function minutesOf(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Whether `minute` (since midnight) on `day` falls inside the window. When the window's end is
 * before its start, it runs past midnight: it covers `start` onward on each listed day, and the
 * early morning of the day after each listed day.
 */
export function isWithinWindow(window: TimeWindow, day: Weekday, minute: number): boolean {
  const start = minutesOf(window.start);
  const end = minutesOf(window.end);
  if (start < end) return window.days.includes(day) && minute >= start && minute < end;
  const previousDay = ((day + 6) % 7) as Weekday;
  return (window.days.includes(day) && minute >= start) || (window.days.includes(previousDay) && minute < end);
}

/** "Monday - Saturday", "MON-FRI", "M-S", "Sat & Sun", "SU" → sorted weekdays; null if unrecognized. */
export function parseDays(text: string): Weekday[] | null {
  const normalized = clean(text).toLowerCase();
  const range = /^([a-z]+)\s*(?:-|to)\s*([a-z]+)$/.exec(normalized);
  if (range) {
    const first = DAY_NAMES[range[1] ?? ''];
    const last = DAY_NAMES[range[2] ?? ''];
    if (first === undefined || last === undefined) return null;
    const days: Weekday[] = [first];
    for (let day = first; day !== last; ) {
      day = ((day + 1) % 7) as Weekday;
      days.push(day);
    }
    return days.sort((a, b) => a - b);
  }

  const days = normalized.split(/\s*(?:&|,|\band\b)\s*/).map((name) => DAY_NAMES[name]);
  if (days.length === 0 || days.some((day) => day === undefined)) return null;
  return [...new Set(days as Weekday[])].sort((a, b) => a - b);
}

/** "8:00", "8AM", "5:00 pm", "Midnight" → "HH:MM". An end time of midnight is "24:00". */
export function parseTime(text: string, role: 'start' | 'end'): string | null {
  const normalized = clean(text).toLowerCase();
  if (normalized === 'midnight') return role === 'start' ? '00:00' : '24:00';
  if (normalized === 'noon') return '12:00';

  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(normalized);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const suffix = match[3];
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (suffix === 'pm' ? 12 : 0);
  }
  if (hour > 24 || minute > 59 || (hour === 24 && minute > 0)) return null;
  if (role === 'end' && hour === 0 && minute === 0) hour = 24;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "8:00 - 17:00", "8AM-6PM", "9pm-Midnight", "24 hours" → start/end; null if unrecognized. */
export function parseTimeRange(text: string): Pick<TimeWindow, 'start' | 'end'> | null {
  const normalized = clean(text).toLowerCase();
  if (normalized === '24 hours' || normalized === '24h') return { start: '00:00', end: '24:00' };
  const parts = normalized.split(/\s*-\s*/);
  if (parts.length !== 2) return null;
  const start = parseTime(parts[0] ?? '', 'start');
  const end = parseTime(parts[1] ?? '', 'end');
  return start && end ? { start, end } : null;
}
