import { centroid } from './geometry.ts';
import { parseDays, parseTimeRange } from './schedule.ts';
import { clean, titleCase } from './text.ts';
import type { NormalizeOutcome, ParkingRule, SourceFeature, TimeWindow } from './types.ts';

export interface WaterlooLotProps {
  OBJECTID: number;
  NAME: string | null;
  ADDRESS: string | null;
  OWNER: string | null;
  CLASS: string | null;
  RESERVED: string | null;
  ACCESSIBLE: string | null;
  DESCR: string | null;
  CAPACITY: string | null;
}

/** Waterloo's layer has no per-record edit dates, so records carry the layer's. */
export function normalizeWaterlooLot(
  feature: SourceFeature<WaterlooLotProps>,
  layerLastEdited: string | null,
): NormalizeOutcome {
  const p = feature.properties;
  // The layer has no stable facility id; OBJECTID is the best available.
  const id = `waterloo-lot-${String(p.OBJECTID)}`;
  const name = clean(p.NAME) || 'Unnamed lot';

  if (clean(p.OWNER) !== 'City of Waterloo') return excluded(id, name, `Owner is ${clean(p.OWNER) || 'missing'}`);
  if (clean(p.CLASS) === 'Motorcycle Parking') return excluded(id, name, 'Motorcycle parking only');
  if (clean(p.RESERVED) === 'Y') return excluded(id, name, 'Reserved parking');
  if (!feature.geometry) return excluded(id, name, 'No geometry');

  const problems: string[] = [];
  const notes: string[] = [];
  const rules: ParkingRule[] = [];

  for (const clause of clean(p.DESCR).split(';').map(clean).filter(Boolean)) {
    const free = /^(\d+) Hour Free Parking (.+)$/i.exec(clause);
    const payAndDisplay = /^Pay & Display Machine (.+) \$(\d*\.?\d+)\/hr$/i.exec(clause);
    const permit = /^(.*?)\s*Permit Parking (.+)$/i.exec(clause);

    if (free) {
      const when = parseSchedule(free[2] ?? '', problems);
      rules.push({ when, access: 'public', price: { kind: 'free' }, maxStayMin: Number(free[1]) * 60 });
    } else if (payAndDisplay) {
      const when = parseSchedule(payAndDisplay[1] ?? '', problems);
      const rate = Number(payAndDisplay[2]);
      const steps = [{ fromMin: 0, toMin: null, amount: rate, blockMin: 60 }];
      rules.push({ when, access: 'public', price: { kind: 'paid', steps, dailyMax: null }, maxStayMin: null });
    } else if (permit) {
      rules.push({ when: parseSchedule(permit[2] ?? '', problems), access: 'permit', price: null, maxStayMin: null });
      if (permit[1]) notes.push(`Permit parking is for ${permit[1]} permit holders`);
    } else if (!clause.includes('$') && /permit|overnight|park it and leave it/i.test(clause)) {
      notes.push(clause);
    } else {
      problems.push(`Unrecognized description clause "${clause}"`);
    }
  }
  if (rules.length === 0 && problems.length === 0) problems.push('No parking rules in description');

  const capacity = clean(p.CAPACITY);
  const spaces = /^(\d+)/.exec(capacity)?.[1];
  if (/combined with adjacent lot/i.test(capacity)) notes.push('Space count is shared with an adjacent lot');
  if (clean(p.ACCESSIBLE) === 'Y') notes.push('Accessible parking available');

  return {
    kind: 'option',
    problems,
    option: {
      id,
      city: 'Waterloo',
      kind: /parkade|garage/i.test(name) ? 'garage' : 'lot',
      name,
      street: titleCase(clean(p.ADDRESS).replace(/^\d+[A-Z]?\s+/i, '')) || null,
      position: centroid(feature.geometry),
      spaces: spaces ? Number(spaces) : null,
      accessibleSpaces: null,
      rules,
      rulesStatus: 'stated',
      openHours: null,
      notes,
      source: {
        dataset: 'waterloo-city-lots',
        objectId: p.OBJECTID,
        updated: layerLastEdited,
        rawText: clean(p.DESCR),
      },
      override: null,
    },
  };
}

/** "Mon-Fri 8am-5pm" → window. */
function parseSchedule(text: string, problems: string[]): TimeWindow | null {
  const match = /^(.+?)\s+(\S+\s*-\s*\S+)$/.exec(clean(text));
  const days = match ? parseDays(match[1] ?? '') : null;
  const range = match ? parseTimeRange(match[2] ?? '') : null;
  if (!days || !range) {
    problems.push(`Unrecognized schedule "${text}"`);
    return null;
  }
  return { days, ...range };
}

function excluded(id: string, name: string, reason: string): NormalizeOutcome {
  return { kind: 'excluded', id, name, reason };
}
