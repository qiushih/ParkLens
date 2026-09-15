import { describe, expect, it } from 'vitest';
import { releaseProblems, type ReleaseInputs } from './release-checks';

const READY: ReleaseInputs = {
  version: '1.0.0',
  reportProblemUrl: 'https://forms.gle/example',
  checkedDates: ['2026-09-14'],
  today: new Date('2026-10-01T12:00:00Z'),
};

describe('releaseProblems', () => {
  it('passes a ready release', () => {
    expect(releaseProblems(READY)).toEqual([]);
  });

  it('requires a report URL, over https', () => {
    expect(releaseProblems({ ...READY, reportProblemUrl: null })).toEqual(['REPORT_PROBLEM_URL in src/shared/links.ts is not set.']);
    expect(releaseProblems({ ...READY, reportProblemUrl: 'http://example.com' })).toEqual([
      'REPORT_PROBLEM_URL in src/shared/links.ts must be an https:// URL.',
    ]);
  });

  it('fails when the oldest source check is more than 90 days old', () => {
    expect(releaseProblems({ ...READY, today: new Date('2026-12-13T12:00:00Z') })).toEqual([]);
    const [problem] = releaseProblems({ ...READY, checkedDates: ['2026-09-14', '2026-06-01'], today: new Date('2026-09-14T12:00:00Z') });
    expect(problem).toMatch(/2026-06-01 \(105 days ago\)/);
  });

  it('requires a Chrome-compatible version', () => {
    expect(releaseProblems({ ...READY, version: '1.0.0-beta' })).toHaveLength(1);
  });
});
