const UPPERCASE_WORDS = new Set(['CC', 'GRT', 'KPL', 'WBT', 'YMCA']);

/** Collapses whitespace and trims; null and undefined become "". */
export function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** "KING ST W" → "King St W", "DUKE & ONTARIO GARAGE" → "Duke & Ontario Garage". */
export function titleCase(text: string | null | undefined): string {
  return clean(text)
    .split(' ')
    .filter(Boolean)
    .map((word) =>
      UPPERCASE_WORDS.has(word.toUpperCase())
        ? word.toUpperCase()
        : word
            .toLowerCase()
            .replace(/(^|[(\-/])([a-z])/g, (_match, before: string, letter: string) => before + letter.toUpperCase()),
    )
    .join(' ');
}

export function isoDate(epochMs: number | null | undefined): string | null {
  return typeof epochMs === 'number' ? new Date(epochMs).toISOString().slice(0, 10) : null;
}

export function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}
