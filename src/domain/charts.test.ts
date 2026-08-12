import { describe, expect, it } from 'vitest';
import {
  diamondPath,
  downsample,
  laneFill,
  markerFor,
  octagonPath,
  plotSeries,
  polylinePath,
} from './charts';

const BOX = { x: 30, y: 14, width: 286, height: 114 };

describe('plotSeries', () => {
  it('returns nothing for an empty series — an empty chart draws no axes', () => {
    expect(plotSeries([], BOX)).toEqual([]);
  });

  it('pins a single reading to the left edge rather than dividing by zero', () => {
    const [only] = plotSeries([{ at: 5, value: 50 }], BOX);
    expect(only?.x).toBe(30);
    expect(only?.y).toBe(71);
  });

  it('maps 0 to the floor and 100 to the ceiling of the box', () => {
    const points = plotSeries(
      [
        { at: 0, value: 0 },
        { at: 10, value: 100 },
      ],
      BOX,
    );
    expect(points[0]).toMatchObject({ x: 30, y: 128, value: 0 });
    expect(points[1]).toMatchObject({ x: 316, y: 14, value: 100 });
  });

  it('spaces readings by their position in the series, not by wall-clock gaps', () => {
    // Three readings, the last one months after the second: an even x-step
    // keeps a fortnight away from compressing a summer of work into one pixel.
    const points = plotSeries(
      [
        { at: 0, value: 10 },
        { at: 1, value: 20 },
        { at: 9_000_000, value: 30 },
      ],
      BOX,
    );
    expect(points.map((p) => p.x)).toEqual([30, 173, 316]);
  });

  it('clamps values outside 0..100 instead of drawing outside the box', () => {
    const points = plotSeries(
      [
        { at: 0, value: -20 },
        { at: 1, value: 140 },
      ],
      BOX,
    );
    expect(points[0]?.y).toBe(128);
    expect(points[1]?.y).toBe(14);
  });
});

describe('polylinePath', () => {
  it('is empty for no points, so no stray path renders', () => {
    expect(polylinePath([])).toBe('');
  });

  it('writes one move and one line per subsequent point', () => {
    expect(
      polylinePath([
        { x: 30, y: 103 },
        { x: 56, y: 93.456 },
      ]),
    ).toBe('M30,103 L56,93.46');
  });

  it('draws a lone point as a zero-length segment so the cap still shows', () => {
    expect(polylinePath([{ x: 30, y: 103 }])).toBe('M30,103 L30,103');
  });
});

describe('downsample', () => {
  it('leaves a short series alone', () => {
    const points = [1, 2, 3].map((n) => ({ at: n, value: n }));
    expect(downsample(points, 10)).toEqual(points);
  });

  it('keeps the first and last reading whatever the cap', () => {
    const points = Array.from({ length: 200 }, (_, i) => ({ at: i, value: i }));
    const thinned = downsample(points, 12);
    expect(thinned).toHaveLength(12);
    expect(thinned[0]).toEqual({ at: 0, value: 0 });
    expect(thinned.at(-1)).toEqual({ at: 199, value: 199 });
  });

  it('refuses a nonsensical cap rather than returning a broken series', () => {
    const points = Array.from({ length: 5 }, (_, i) => ({ at: i, value: i }));
    expect(downsample(points, 1)).toEqual([points[0], points[4]]);
  });
});

describe('markerFor', () => {
  const points = plotSeries(
    [
      { at: 100, value: 0 },
      { at: 200, value: 50 },
      { at: 300, value: 100 },
    ],
    BOX,
  );

  it('has nowhere to sit on an empty chart', () => {
    expect(markerFor([], 100)).toBeNull();
  });

  it('lands on the nearest reading in time', () => {
    expect(markerFor(points, 205)).toMatchObject({ x: 173, y: 71 });
    expect(markerFor(points, 299)).toMatchObject({ x: 316, y: 14 });
  });

  it('clamps to the ends for a timestamp outside the series', () => {
    expect(markerFor(points, 0)?.x).toBe(30);
    expect(markerFor(points, 9_999)?.x).toBe(316);
  });
});

describe('sign geometry for chart markers', () => {
  it('draws a four-point diamond around its centre', () => {
    expect(diamondPath(100, 50, 6)).toBe('M100,44 L106,50 L100,56 L94,50 Z');
  });

  it('draws a regular octagon whose flats are horizontal and vertical', () => {
    const path = octagonPath(100, 50, 6);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    // Eight vertices: one move, seven lines.
    expect(path.split(' L')).toHaveLength(8);
  });
});

describe('laneFill', () => {
  it('is zero-width when nothing has been answered — an empty lane, not a bar of nothing', () => {
    expect(laneFill(0, 320)).toBe(0);
  });

  it('is the full track at 100 percent', () => {
    expect(laneFill(100, 320)).toBe(320);
  });

  it('clamps out-of-range input', () => {
    expect(laneFill(-5, 320)).toBe(0);
    expect(laneFill(140, 320)).toBe(320);
  });
});
