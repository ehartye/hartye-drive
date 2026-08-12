import { describe, it, expect } from 'vitest';
import { allSigns } from '~/signs/signs';
import { matchesSignQuery, searchIndex } from './search';

const byId = (id: string) => allSigns.find((sign) => sign.id === id);

const stop = byId('r1-1-stop');
const school = byId('s1-1-school');
const workzone = byId('w20-1-road-work-ahead');
const hospital = byId('d9-2-hospital');

describe('searchIndex', () => {
  it('carries the name, the shape, the colour, the category and the designation', () => {
    if (!stop) throw new Error('r1-1-stop missing from the registry');
    const index = searchIndex(stop);
    expect(index).toContain('stop');
    expect(index).toContain('octagon');
    expect(index).toContain('red');
    expect(index).toContain('regulatory');
    expect(index).toContain('r1-1');
  });

  it('spells fluorescent yellow-green as a learner would say it', () => {
    if (!school) throw new Error('s1-1-school missing from the registry');
    expect(searchIndex(school)).toContain('fluorescent yellow-green');
    expect(searchIndex(school)).toContain('pentagon');
  });
});

describe('matchesSignQuery', () => {
  it('matches everything on an empty or whitespace query', () => {
    if (!stop) throw new Error('r1-1-stop missing');
    expect(matchesSignQuery(stop, '')).toBe(true);
    expect(matchesSignQuery(stop, '   ')).toBe(true);
  });

  it('finds a sign by its name, ignoring case', () => {
    if (!stop) throw new Error('r1-1-stop missing');
    expect(matchesSignQuery(stop, 'StOp')).toBe(true);
  });

  it('finds signs by shape and by colour — the two things you read first', () => {
    if (!school || !workzone || !hospital) throw new Error('registry entries missing');
    expect(matchesSignQuery(school, 'pentagon')).toBe(true);
    expect(matchesSignQuery(workzone, 'orange')).toBe(true);
    expect(matchesSignQuery(hospital, 'blue')).toBe(true);
  });

  it('requires every word of a multi-word query, in any order', () => {
    if (!workzone) throw new Error('w20-1 missing');
    expect(matchesSignQuery(workzone, 'orange diamond')).toBe(true);
    expect(matchesSignQuery(workzone, 'diamond orange')).toBe(true);
    expect(matchesSignQuery(workzone, 'orange octagon')).toBe(false);
  });

  it('finds nothing for a word Tennessee does not post a sign for', () => {
    expect(allSigns.filter((sign) => matchesSignQuery(sign, 'roundabout'))).toEqual([]);
  });

  it('reaches the meaning, so a plain-language search still lands', () => {
    if (!stop) throw new Error('r1-1-stop missing');
    expect(matchesSignQuery(stop, 'complete stop')).toBe(true);
  });
});
