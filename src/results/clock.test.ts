import { describe, expect, it } from 'vitest';
import { localMoment } from './clock';

describe('localMoment', () => {
  it('uses Kitchener–Waterloo time during daylight saving (UTC−4)', () => {
    const moment = localMoment(new Date('2026-09-14T19:42:00Z'));
    expect(moment).toMatchObject({ day: 1, minute: 15 * 60 + 42 });
    expect(moment.label).toMatch(/3:42/);
  });

  it('uses Kitchener–Waterloo time in winter (UTC−5), including the day change', () => {
    // 05:30 UTC Saturday is 00:30 Saturday in Toronto.
    expect(localMoment(new Date('2026-01-10T05:30:00Z'))).toMatchObject({ day: 6, minute: 30 });
    // 03:30 UTC Saturday is still 22:30 Friday in Toronto.
    expect(localMoment(new Date('2026-01-10T03:30:00Z'))).toMatchObject({ day: 5, minute: 22 * 60 + 30 });
  });

  it('reports midnight as minute 0', () => {
    expect(localMoment(new Date('2026-09-14T04:00:00Z'))).toMatchObject({ day: 1, minute: 0 });
  });
});
