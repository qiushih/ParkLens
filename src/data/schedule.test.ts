import { describe, expect, it } from 'vitest';
import { isWithinWindow, minutesOf, parseDays, parseTime, parseTimeRange } from './schedule.ts';
import type { TimeWindow } from './types.ts';

describe('parseDays', () => {
  it.each([
    // Every day format present in the source data.
    ['Monday - Saturday', [1, 2, 3, 4, 5, 6]],
    ['Monday - Sunday', [0, 1, 2, 3, 4, 5, 6]],
    ['MON-FRI', [1, 2, 3, 4, 5]],
    ['Mon-Fri', [1, 2, 3, 4, 5]],
    ['Mon-Sat', [1, 2, 3, 4, 5, 6]],
    ['M-S', [1, 2, 3, 4, 5, 6]],
    ['SU', [0]],
    ['Sat & Sun', [0, 6]],
    ['MONDAY TO FRIDAY', [1, 2, 3, 4, 5]],
    ['Friday - Monday', [0, 1, 5, 6]],
  ])('%s', (text, expected) => {
    expect(parseDays(text)).toEqual(expected);
  });

  it.each(['', 'Weekdays', 'Mon-Funday'])('rejects %j', (text) => {
    expect(parseDays(text)).toBeNull();
  });
});

describe('isWithinWindow', () => {
  const [SUN, MON, SAT] = [0, 1, 6] as const;
  const businessHours = { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' } satisfies TimeWindow;
  const monSatOvernight = { days: [1, 2, 3, 4, 5, 6], start: '17:00', end: '06:00' } satisfies TimeWindow;

  it('treats start as inclusive and end as exclusive', () => {
    expect(isWithinWindow(businessHours, MON, minutesOf('08:00'))).toBe(true);
    expect(isWithinWindow(businessHours, MON, minutesOf('16:59'))).toBe(true);
    expect(isWithinWindow(businessHours, MON, minutesOf('17:00'))).toBe(false);
    expect(isWithinWindow(businessHours, SAT, minutesOf('10:00'))).toBe(false);
  });

  it('runs "24:00" to the end of the day', () => {
    expect(isWithinWindow({ days: [SUN], start: '00:00', end: '24:00' }, SUN, minutesOf('23:59'))).toBe(true);
  });

  it.each([
    ['Saturday 17:00', SAT, '17:00', true],
    ['Saturday 23:59', SAT, '23:59', true],
    ['Sunday 00:00 (Saturday night)', SUN, '00:00', true],
    ['Sunday 05:59 (Saturday night)', SUN, '05:59', true],
    ['Sunday 06:00', SUN, '06:00', false],
    ['Sunday 23:00 (Sunday not listed)', SUN, '23:00', false],
    ['Monday 05:59 (Sunday night)', MON, '05:59', false],
    ['Monday 16:59', MON, '16:59', false],
    ['Monday 17:00', MON, '17:00', true],
  ] as const)('overnight Mon–Sat 17:00–06:00: %s → %s', (_label, day, time, expected) => {
    expect(isWithinWindow(monSatOvernight, day, minutesOf(time))).toBe(expected);
  });
});

describe('parseTime', () => {
  it.each([
    ['8:00', 'start', '08:00'],
    ['8AM', 'start', '08:00'],
    ['12pm', 'start', '12:00'],
    ['12am', 'start', '00:00'],
    ['5:00 pm', 'end', '17:00'],
    ['24:00', 'end', '24:00'],
    ['Midnight', 'start', '00:00'],
    ['Midnight', 'end', '24:00'],
    ['0:00', 'end', '24:00'],
  ] as const)('%s as %s → %s', (text, role, expected) => {
    expect(parseTime(text, role)).toBe(expected);
  });

  it.each(['13pm', '25:00', '8:60', '24:30', 'soon'])('rejects %j', (text) => {
    expect(parseTime(text, 'start')).toBeNull();
  });
});

describe('parseTimeRange', () => {
  it.each([
    // Every hours format present in the source data.
    ['8:00 - 17:00', { start: '08:00', end: '17:00' }],
    ['8:00 - 24:00', { start: '08:00', end: '24:00' }],
    ['6:00 - 14:30', { start: '06:00', end: '14:30' }],
    ['8:00 am - 5:00 pm', { start: '08:00', end: '17:00' }],
    ['8AM-6PM', { start: '08:00', end: '18:00' }],
    ['9am-9pm', { start: '09:00', end: '21:00' }],
    ['9pm-Midnight', { start: '21:00', end: '24:00' }],
    ['Midnight-8am', { start: '00:00', end: '08:00' }],
    ['24 hours', { start: '00:00', end: '24:00' }],
  ])('%s', (text, expected) => {
    expect(parseTimeRange(text)).toEqual(expected);
  });

  it('rejects multi-segment hours it cannot represent as one window', () => {
    expect(parseTimeRange('8:00-24:00 M-S/12:00-24:00 SU')).toBeNull();
  });
});
