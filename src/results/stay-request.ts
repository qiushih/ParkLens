import type { Weekday } from '../data/types';
import { localMoment } from './clock';
import { formatDayTime, formatDuration, WEEKDAY_LONG } from './format';
import type { StayRequest } from './stay';

export const DURATION_CHOICES = [30, 60, 120, 180, 240, 480] as const;
export const DEFAULT_DURATION_MIN = 120;

export type Arrival = { kind: 'now' } | { kind: 'later'; dayOffset: number; minute: number };

/** What the visitor picked in the panel's controls. */
export interface StayChoice {
  durationMin: number;
  arrival: Arrival;
}

export interface ResolvedStay {
  request: StayRequest;
  /** e.g. "2 hr stay, arriving now (Mon 3:42 p.m.)". */
  label: string;
}

export function resolveStay(choice: StayChoice, now: Date): ResolvedStay {
  const moment = localMoment(now);
  const duration = formatDuration(choice.durationMin);

  if (choice.arrival.kind === 'now') {
    return {
      request: { day: moment.day, minute: moment.minute, durationMin: choice.durationMin },
      label: `${duration} stay, arriving now (${moment.label})`,
    };
  }

  const day = ((moment.day + choice.arrival.dayOffset) % 7) as Weekday;
  return {
    request: { day, minute: choice.arrival.minute, durationMin: choice.durationMin },
    label: `${duration} stay, arriving ${formatDayTime(day, choice.arrival.minute)}`,
  };
}

/** Labels for the next seven days: "Today", "Tomorrow", then weekday names. */
export function dayOptionLabels(now: Date): string[] {
  const today = localMoment(now).day;
  return Array.from({ length: 7 }, (_, offset) =>
    offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : WEEKDAY_LONG[(today + offset) % 7] ?? '',
  );
}
