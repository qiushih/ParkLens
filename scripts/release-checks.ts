/** Rates, rules and street-rule wording must have been checked against city websites this recently. */
export const MAX_CHECK_AGE_DAYS = 90;

export interface ReleaseInputs {
  version: string;
  reportProblemUrl: string | null;
  /** ISO dates overrides and street rules were last checked against city websites. */
  checkedDates: string[];
  today: Date;
}

/** Everything that must be fixed before packaging a store release; empty when ready. */
export function releaseProblems({ version, reportProblemUrl, checkedDates, today }: ReleaseInputs): string[] {
  const problems: string[] = [];

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    problems.push(`package.json version "${version}" must be MAJOR.MINOR.PATCH for Chrome.`);
  }

  if (!reportProblemUrl) {
    problems.push('REPORT_PROBLEM_URL in src/shared/links.ts is not set.');
  } else if (!reportProblemUrl.startsWith('https://')) {
    problems.push('REPORT_PROBLEM_URL in src/shared/links.ts must be an https:// URL.');
  }

  const oldest = [...checkedDates].sort()[0];
  if (oldest) {
    const ageDays = Math.floor((today.getTime() - Date.parse(`${oldest}T00:00:00Z`)) / 86_400_000);
    if (ageDays > MAX_CHECK_AGE_DAYS) {
      problems.push(
        `The oldest rate or rule check is from ${oldest} (${String(ageDays)} days ago). Re-check the city pages cited in src/data/overrides.ts and src/results/street-rules.ts, then update their checked dates.`,
      );
    }
  }

  return problems;
}
