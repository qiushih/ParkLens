import type { Weekday } from '../data/types';
import { formatDayTime } from './format';

/** Parking rules are local to Kitchener–Waterloo, whatever time zone the browser is in. */
export const PARKING_TIME_ZONE = 'America/Toronto';

export interface LocalMoment {
  day: Weekday;
  /** Minutes since local midnight. */
  minute: number;
  /** e.g. "Mon 3:42 p.m." */
  label: string;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PARKING_TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function localMoment(date: Date): LocalMoment {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  const index = WEEKDAY_NAMES.indexOf(parts.weekday ?? '');
  if (index === -1) throw new Error(`Unexpected weekday "${parts.weekday ?? ''}"`);
  const day = index as Weekday;
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return { day, minute, label: formatDayTime(day, minute) };
}
