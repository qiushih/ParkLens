import { describe, expect, it } from 'vitest';
import { formatDayTime, formatTime } from './format';
import { dayOptionLabels, resolveStay } from './stay-request';

// Monday 2026-09-14, 3:42 p.m. and Saturday 2026-09-19, noon, in Kitchener–Waterloo.
const MONDAY_AFTERNOON = new Date('2026-09-14T19:42:00Z');
const SATURDAY_NOON = new Date('2026-09-19T16:00:00Z');

describe('resolveStay', () => {
  it('arrives now, in local time', () => {
    expect(resolveStay({ durationMin: 120, arrival: { kind: 'now' } }, MONDAY_AFTERNOON)).toEqual({
      request: { day: 1, minute: 15 * 60 + 42, durationMin: 120 },
      label: '2 hr stay, arriving now (Mon 3:42 p.m.)',
    });
  });

  it('arrives later, counting days from today and wrapping the week', () => {
    expect(resolveStay({ durationMin: 180, arrival: { kind: 'later', dayOffset: 1, minute: 9 * 60 } }, SATURDAY_NOON)).toEqual({
      request: { day: 0, minute: 540, durationMin: 180 },
      label: '3 hr stay, arriving Sun 9:00 a.m.',
    });
  });
});

describe('dayOptionLabels', () => {
  it('starts with Today and Tomorrow, then names the weekdays', () => {
    expect(dayOptionLabels(SATURDAY_NOON)).toEqual(['Today', 'Tomorrow', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  });
});

describe('formatTime', () => {
  it.each([
    [0, '12:00 a.m.'],
    [9 * 60, '9:00 a.m.'],
    [12 * 60, '12:00 p.m.'],
    [17 * 60, '5:00 p.m.'],
    [23 * 60 + 59, '11:59 p.m.'],
    [24 * 60, '12:00 a.m.'],
  ])('%d → %s', (minute, expected) => {
    expect(formatTime(minute)).toBe(expected);
  });

  it('formats a day and time', () => {
    expect(formatDayTime(0, 540)).toBe('Sun 9:00 a.m.');
  });
});
