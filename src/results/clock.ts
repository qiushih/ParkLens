import type { Weekday } from '../data/types';

/** Parking rules are local to Kitchener–Waterloo, whatever time zone the browser is in. */
export const PARKING_TIME_ZONE = 'America/Toronto';

export interface LocalMoment {
  day: Weekday;
  /** Minutes since local midnight. */
  minute: number;
  /** e.g. "Mon, 3:42 p.m." */
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

const labelFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARKING_TIME_ZONE,
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export function localMoment(date: Date): LocalMoment {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  const day = WEEKDAY_NAMES.indexOf(parts.weekday ?? '');
  if (day === -1) throw new Error(`Unexpected weekday "${parts.weekday ?? ''}"`);
  return {
    day: day as Weekday,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    label: labelFormatter.format(date),
  };
}
