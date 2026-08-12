import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CorrectionNotice, ManualLookup, QueuedAgain } from './parts';
import { formatEffectiveDate, signForTopic } from './support';
import { correctionById } from '~/content';
import { getSign } from '~/signs/signs';

describe('formatEffectiveDate', () => {
  it('spells the real date out — practices D10 forbids "in force 2023"', () => {
    expect(formatEffectiveDate('2023-07-01')).toBe('July 1, 2023');
    expect(formatEffectiveDate('2025-05-07')).toBe('May 7, 2025');
  });

  it('falls back to the raw value rather than rendering "Invalid Date"', () => {
    expect(formatEffectiveDate('not-a-date')).toBe('not-a-date');
  });
});

describe('signForTopic', () => {
  it('gives a mapped topic its own registry sign', () => {
    expect(signForTopic('railroad-crossing-signs', 'signs')).toBe('r15-1-crossbuck');
  });

  it('falls back by blueprint area for a topic the map does not carry', () => {
    expect(signForTopic('a-topic-added-later', 'alcohol-drugs')).toBe('r1-1-stop');
  });

  it('returns registry ids, not the mockup sprite names it used to return', () => {
    // The bug this replaced: every id here was a sprite name (`stop`,
    // `crossbuck`), so every study session drew an empty dashed box.
    for (const topic of ['regulatory-signs', 'required-stops', 'dui-penalties']) {
      expect(getSign(signForTopic(topic, 'signs')), topic).toBeDefined();
    }
  });
});

describe('CorrectionNotice', () => {
  it('discloses the change, its effective date and the authority behind it', () => {
    const correction = correctionById('move-over-any-hazard-lights');
    expect(correction).toBeDefined();
    render(<CorrectionNotice correction={correction!} />);

    expect(screen.getByText(/This rule moved after the manual was written/i)).toBeInTheDocument();
    expect(screen.getByText(/In force since July 1, 2023/)).toBeInTheDocument();
    expect(screen.getByText(/Public Chapter 354/)).toBeInTheDocument();
  });
});

describe('ManualLookup', () => {
  const citation = { pdfPage: 86, printedPage: 72, quote: 'A verbatim passage.' };

  it('records both page numbers, because the manual cross-references the printed one', () => {
    render(<ManualLookup citation={citation} section="Interstate driving" />);
    expect(screen.getByText(/PDF p\. 86 \(printed p\. 72\)/)).toBeInTheDocument();
    expect(screen.getByText(/Content current as of July 1, 2022/)).toBeInTheDocument();
  });

  it('is a real disclosure control, closed until asked for', () => {
    render(<ManualLookup citation={citation} section="Interstate driving" />);
    const summary = screen.getByText('Look it up in the manual').closest('summary');
    expect(summary).not.toBeNull();
    expect(summary?.closest('details')?.open).toBe(false);
  });

  it('says when the quoted passage has been superseded', () => {
    render(
      <ManualLookup citation={citation} section="Interstate driving" supersededNote="superseded" />,
    );
    expect(screen.getByText(/superseded/)).toBeInTheDocument();
  });
});

describe('QueuedAgain', () => {
  it('prints the scheduler’s own sentence, so the promise is the real one', () => {
    render(<QueuedAgain sentence="You'll see this one in about ten minutes." />);
    expect(screen.getByText('Queued again')).toBeInTheDocument();
    expect(screen.getByText(/in about ten minutes/)).toBeInTheDocument();
  });
});
