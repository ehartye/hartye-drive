import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import { CategoryHead, CategoryLinks, ColorKey, MasteryBadge, SignCard } from './parts';
import { SIGN_CATEGORIES, categoryMeta } from './categories';
import { allSigns } from '~/signs/signs';
import { newCard, reviewCard } from '~/domain/scheduler';

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);
const at = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const stop = allSigns.find((sign) => sign.id === 'r1-1-stop');
if (!stop) throw new Error('r1-1-stop missing from the registry');

describe('MasteryBadge', () => {
  it('says the tier in words, not only in pips (§5)', () => {
    at(<MasteryBadge card={undefined} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('lights one pip per box and hides them from assistive tech', () => {
    const { container } = at(<MasteryBadge card={reviewCard(newCard('a', 'w', T0), true, T0)} />);
    expect(container.querySelectorAll('.pip.is-on')).toHaveLength(1);
    expect(container.querySelectorAll('.pip[aria-hidden="true"]')).toHaveLength(3);
    expect(screen.getByText('Review')).toBeInTheDocument();
  });
});

describe('SignCard', () => {
  it('names the face by shape and colour, and the card by what it means', () => {
    at(<SignCard sign={stop} card={undefined} onOpen={() => undefined} />);
    const card = screen.getByRole('button');
    // Shape and colour from the face, then the name and the meaning from the
    // card's own text: everything a sighted learner reads, in reading order.
    expect(card).toHaveAccessibleName(/Octagon, red/);
    expect(card).toHaveAccessibleName(/STOP/);
    expect(card).toHaveAccessibleName(/complete stop/);
    expect(screen.getByRole('img', { name: 'Octagon, red' })).toBeInTheDocument();
  });

  it('hands its registry id back when opened', () => {
    const onOpen = vi.fn();
    at(<SignCard sign={stop} card={undefined} onOpen={onOpen} />);
    screen.getByRole('button').click();
    expect(onOpen).toHaveBeenCalledWith('r1-1-stop');
  });
});

describe('CategoryHead', () => {
  const warning = categoryMeta('warning');
  if (!warning) throw new Error('warning category missing');

  it('states the rule as a lesson, not as a label', () => {
    at(<CategoryHead meta={warning} shown={4} total={33} headingId="h" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Warning' })).toBeInTheDocument();
    expect(screen.getByText(/Yellow diamond\./)).toBeInTheDocument();
    expect(screen.getByText('4 of 33')).toBeInTheDocument();
  });

  it('says the plain count when nothing is held back', () => {
    at(<CategoryHead meta={warning} shown={33} total={33} headingId="h" />);
    expect(screen.getByText('33 signs')).toBeInTheDocument();
  });

  it('does not pluralise a category of one', () => {
    at(<CategoryHead meta={warning} shown={1} total={1} headingId="h" />);
    expect(screen.getByText('1 sign')).toBeInTheDocument();
  });
});

describe('ColorKey', () => {
  it('teaches colour first, with a real face beside every rule', () => {
    const { container } = at(<ColorKey />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Color is the first thing you read' }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.keylist li')).toHaveLength(7);
    // The faces are decorative here: the sentence beside each one says it all.
    expect(container.querySelectorAll('.keylist svg[aria-hidden="true"]')).toHaveLength(7);
    expect(screen.getByText(/a warning\. Something ahead/)).toBeInTheDocument();
  });

  it('draws every key entry from a real registry id', () => {
    const { container } = at(<ColorKey />);
    expect(container.querySelectorAll('[data-missing-sign], [data-pending-sign]')).toHaveLength(0);
  });
});

describe('CategoryLinks', () => {
  it('offers every category as a way out, with its count and its blurb', () => {
    const onPick = vi.fn();
    at(<CategoryLinks counts={{ warning: 33, regulatory: 27 }} onPick={onPick} />);
    expect(screen.getAllByRole('button')).toHaveLength(SIGN_CATEGORIES.length);
    expect(screen.getByText('Yellow diamond — something ahead needs you')).toBeInTheDocument();
    expect(screen.getByText('33')).toBeInTheDocument();
    // A category the caller said nothing about reads zero, not blank.
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);

    screen.getByRole('button', { name: /Warning/ }).click();
    expect(onPick).toHaveBeenCalledWith('warning');
  });
});
