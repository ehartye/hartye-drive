/**
 * `SignSvg` has two fallbacks and the registry is now fully drawn, so neither
 * is reachable through real data. They still have to work: the day someone adds
 * an 88th entry to `signs.json` without a face, the app must show a labelled
 * plate carrying the MUTCD designation rather than a blank space — that is the
 * difference between a visible gap and a silent one.
 *
 * The geometry module is stubbed rather than the registry, because the seam
 * being exercised is exactly "entry exists, face does not".
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SignFace } from '~/signs/registry';

vi.mock('~/signs/signs', () => ({
  getSign: (id: string): SignFace | undefined =>
    id === 'x9-9-undrawn'
      ? {
          entry: {
            id: 'x9-9-undrawn',
            mutcd: 'X9-9',
            name: 'Undrawn',
            category: 'warning',
            shape: 'diamond',
            faceColor: 'yellow',
            legendColor: 'black',
            meaning: 'A registry entry whose face nobody has authored yet.',
            citation: { pdfPage: 50, printedPage: 36, quote: 'x' },
          },
          geometry: undefined,
        }
      : undefined,
}));

const { SignSvg } = await import('./SignSvg');

describe('SignSvg fallbacks', () => {
  it('plates a registry sign with no geometry, stating its MUTCD designation', () => {
    const { container } = render(<SignSvg id="x9-9-undrawn" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-pending-sign', 'X9-9');
    expect(svg).toHaveClass('sign--pending');
    expect(svg?.textContent).toContain('X9-9');
    expect(svg?.textContent).toContain('art pending');
    // Still fully named: the registry knows shape, colour and meaning.
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Diamond, yellow — .+/);
  });

  it('flags an id the registry does not carry instead of hiding it', () => {
    const { container } = render(<SignSvg id="not-a-registry-id" />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'data-missing-sign',
      'not-a-registry-id',
    );
    expect(screen.queryByRole('img')).toBeNull();
  });
});
