import { describe, expect, it } from 'vitest';
import { STREET_RULES, STREET_RULES_DISCLAIMER, streetRulesFor } from './street-rules';

describe('streetRulesFor', () => {
  it("shows one city's rules when nearby parking is all in that city", () => {
    expect(streetRulesFor(new Set(['Kitchener'])).map((note) => note.city)).toEqual(['Kitchener']);
    expect(streetRulesFor(new Set(['Waterloo'])).map((note) => note.city)).toEqual(['Waterloo']);
  });

  it('shows both when nearby parking spans both cities or there is none', () => {
    expect(streetRulesFor(new Set(['Kitchener', 'Waterloo'])).map((note) => note.city)).toEqual(['Kitchener', 'Waterloo']);
    expect(streetRulesFor(new Set()).map((note) => note.city)).toEqual(['Kitchener', 'Waterloo']);
  });
});

describe('STREET_RULES', () => {
  it.each(Object.values(STREET_RULES))("covers $city's 3-hour limit, overnight rule and snow events, with sources", (note) => {
    const text = note.points.join(' ');
    expect(text).toMatch(/3 hours/);
    expect(text).toMatch(/2:30 to 6 a\.m\./);
    expect(text).toMatch(/snow event/);
    expect(text).toMatch(/unless signs say otherwise/);
    expect(note.sources.length).toBeGreaterThan(0);
    for (const source of note.sources) expect(source.url).toMatch(/^https:\/\/www\.(kitchener|waterloo)\.ca\//);
  });

  it('tells people the note is not a parking spot and to check posted signs', () => {
    expect(STREET_RULES_DISCLAIMER).toMatch(/isn't a parking spot/);
    expect(STREET_RULES_DISCLAIMER).toMatch(/check the signs/);
  });
});
