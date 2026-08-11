import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';

import {
  AppBar,
  AppNav,
  Button,
  ChoiceRow,
  Chip,
  CitationLink,
  ConfirmGate,
  DateField,
  Dialog,
  EmptyState,
  ErrorState,
  ExplanationBlock,
  FocusChrome,
  LoadingSkeleton,
  MileMarker,
  OfflineBadge,
  ProgressRail,
  QuestionCard,
  RouteShield,
  SearchField,
  SegmentedField,
  SignPanel,
  SignSvg,
  StatTile,
  StrikeCounter,
  SwitchRow,
  Timer,
  Toast,
  ToastDock,
  TopicMeter,
  VerdictSign,
  VisuallyHidden,
} from './index';

const inRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/* ------------------------------------------------------------------ SignSvg */

describe('SignSvg (grounding §5 A8)', () => {
  it('names the sign by shape AND colour AND meaning', () => {
    render(<SignSvg id="stop" />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Octagon, red — stop completely before the stop line',
    );
  });

  it('withholds the meaning in drill mode, but is never nameless', () => {
    render(<SignSvg id="stop" mode="drill" />);
    const name = screen.getByRole('img').getAttribute('aria-label') ?? '';
    expect(name).toBe('Octagon, red');
    expect(name).not.toMatch(/stop completely/);
  });

  it('is hidden from assistive tech when purely decorative', () => {
    const { container } = render(<SignSvg id="stop" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the school warning sign in fluorescent yellow-green, never pink', () => {
    const { container } = render(<SignSvg id="school-crossing" decorative />);
    const markup = container.innerHTML.toLowerCase();
    expect(markup).toContain('#c7ea00');
    expect(markup).not.toContain('#ee5fa7');
  });

  it('renders YIELD as a white face with a red border, not the inverse', () => {
    const { container } = render(<SignSvg id="yield" decorative />);
    const polys = [...container.querySelectorAll('polygon')].map((p) => p.getAttribute('fill'));
    expect(polys).toContain('#F2F4F1');
    expect(polys).toContain('#B4151C');
  });

  it('takes a size class so the sign can dominate a drill screen', () => {
    const { container } = render(<SignSvg id="stop" size="hero" decorative />);
    expect(container.querySelector('svg')).toHaveClass('sign', 'sign--hero');
  });
});

/* ---------------------------------------------------------------- SignPanel */

describe('SignPanel', () => {
  it('carries the retroreflective panel treatment and the requested variant', () => {
    const { container } = render(<SignPanel variant="warn">body</SignPanel>);
    expect(container.firstElementChild).toHaveClass('panel', 'panel--warn');
  });

  it('can drop the sheen for quiet surfaces', () => {
    const { container } = render(<SignPanel flat>body</SignPanel>);
    expect(container.firstElementChild).toHaveClass('panel--flat');
  });

  it('renders as the requested element so headings stay in a landmark', () => {
    const { container } = render(<SignPanel as="section">body</SignPanel>);
    expect(container.firstElementChild?.tagName).toBe('SECTION');
  });
});

/* -------------------------------------------------------------------- Button */

describe('Button', () => {
  it.each([
    ['guide', 'btn--guide'],
    ['quiet', 'btn--quiet'],
    ['danger', 'btn--danger'],
  ] as const)('renders the %s variant', (variant, cls) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('btn', cls);
  });

  it('renders as a link when given a destination, keeping button styling', () => {
    inRouter(
      <Button variant="guide" to="/study">
        Continue studying
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Continue studying' });
    expect(link).toHaveAttribute('href', '/study');
    expect(link).toHaveClass('btn', 'btn--guide');
  });

  it('stays focusable but inert when disabled, so the reason can be read', () => {
    const onClick = vi.fn();
    render(
      <Button variant="guide" disabled onClick={onClick}>
        Erase
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Erase' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).not.toHaveAttribute('disabled');
    btn.click();
    expect(onClick).not.toHaveBeenCalled();
  });
});

/* ----------------------------------------------------------------- ChoiceRow */

describe('ChoiceRow (grounding §3)', () => {
  it('is a neutral, unpressed button by default', () => {
    render(<ChoiceRow letter="A">Stop and stay stopped.</ChoiceRow>);
    const row = screen.getByRole('button', { name: /Stop and stay stopped/ });
    expect(row).toHaveAttribute('aria-pressed', 'false');
    expect(row).toHaveClass('choice');
    expect(row.className).not.toMatch(/choice--(correct|wrong|muted)/);
  });

  it('keys the picked-verdict-withheld state off aria-pressed with no colour class', () => {
    render(
      <ChoiceRow letter="B" picked>
        Slow to 15 mph.
      </ChoiceRow>,
    );
    const row = screen.getByRole('button', { name: /Slow to 15 mph/ });
    expect(row).toHaveAttribute('aria-pressed', 'true');
    // Any colour here would leak the answer in exam mode.
    expect(row.className).not.toMatch(/choice--(correct|wrong)/);
  });

  it('pairs correct with an icon AND a word, never colour alone', () => {
    render(
      <ChoiceRow letter="A" state="correct">
        Stop and stay stopped.
      </ChoiceRow>,
    );
    const row = screen.getByRole('button', { name: /Stop and stay stopped/ });
    expect(row).toHaveClass('choice--correct');
    expect(within(row).getByText('Correct answer')).toBeInTheDocument();
    expect(row.querySelector('.verdict svg')).toBeTruthy();
  });

  it('pairs incorrect with an icon AND a word', () => {
    render(
      <ChoiceRow letter="C" state="incorrect" picked>
        Keep driving.
      </ChoiceRow>,
    );
    const row = screen.getByRole('button', { name: /Keep driving/ });
    expect(row).toHaveClass('choice--wrong');
    expect(within(row).getByText('Your answer · incorrect')).toBeInTheDocument();
  });

  it('keeps aria-pressed AND the verdict class together on a picked correct answer', () => {
    // The specificity trap, asserted at the component level too.
    render(
      <ChoiceRow letter="A" state="correct" picked>
        Stop and stay stopped.
      </ChoiceRow>,
    );
    const row = screen.getByRole('button', { name: /Stop and stay stopped/ });
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(row).toHaveClass('choice--correct');
    expect(within(row).getByText('Your answer · correct')).toBeInTheDocument();
  });

  it('mutes the choices that were neither picked nor correct', () => {
    render(
      <ChoiceRow letter="B" state="muted">
        Slow to 15 mph.
      </ChoiceRow>,
    );
    expect(screen.getByRole('button', { name: /Slow to 15/ })).toHaveClass('choice--muted');
  });

  it('is inert once the verdict is out', async () => {
    const onSelect = vi.fn();
    render(
      <ChoiceRow letter="A" state="correct" disabled onSelect={onSelect}>
        Stop.
      </ChoiceRow>,
    );
    const row = screen.getByRole('button', { name: /Stop/ });
    expect(row).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('is operable by keyboard', async () => {
    const onSelect = vi.fn();
    render(
      <ChoiceRow letter="A" onSelect={onSelect}>
        Stop.
      </ChoiceRow>,
    );
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Stop/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------- QuestionCard */

describe('QuestionCard', () => {
  it('sets the stem in the gothic face and labels the choice group with it', () => {
    render(
      <QuestionCard eyebrow="Adaptive session" topic="School buses" stem="What must you do?">
        <ChoiceRow letter="A">Stop.</ChoiceRow>
      </QuestionCard>,
    );
    const stem = screen.getByRole('heading', { name: 'What must you do?' });
    expect(stem).toHaveClass('stem');
    const group = screen.getByRole('group', { name: 'What must you do?' });
    expect(within(group).getByRole('button', { name: /Stop/ })).toBeInTheDocument();
  });

  it('announces the resolved verdict once, in a live region', () => {
    render(
      <QuestionCard stem="What must you do?" announcement="Incorrect. The answer is A.">
        <ChoiceRow letter="A">Stop.</ChoiceRow>
      </QuestionCard>,
    );
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Incorrect. The answer is A.');
  });
});

/* ---------------------------------------------------------- ExplanationBlock */

describe('ExplanationBlock', () => {
  const citation = {
    section: 'Sharing the Road',
    pdfPage: 79,
    printedPage: 65,
    quote: 'A turn lane in the middle of a four-lane highway is NOT considered a barrier.',
  };

  it('renders rule, verbatim quote and citation, with the quote in the reading face', () => {
    inRouter(
      <ExplanationBlock verdict="incorrect" answerLetter="A" citation={citation}>
        A center turn lane is paint, not a divider.
      </ExplanationBlock>,
    );
    expect(screen.getByText(/A center turn lane is paint/)).toBeInTheDocument();
    const quote = screen.getByText(/NOT considered a barrier/);
    expect(quote).toHaveClass('cite__quote');
    expect(screen.getByText(/PDF p\. 79/)).toBeInTheDocument();
    expect(screen.getByText(/printed p\. 65/)).toBeInTheDocument();
  });

  it('states the verdict in words as well as colour', () => {
    inRouter(
      <ExplanationBlock verdict="incorrect" answerLetter="A" citation={citation}>
        rule
      </ExplanationBlock>,
    );
    expect(screen.getByText('Incorrect · the answer is A')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------- markers and meters */

describe('MileMarker', () => {
  it('reads as a position in a real sequence', () => {
    render(<MileMarker index={7} total={12} />);
    expect(screen.getByText('07')).toBeInTheDocument();
    expect(screen.getByText('MILE')).toBeInTheDocument();
    expect(screen.getByText('of 12')).toBeInTheDocument();
  });
});

describe('RouteShield', () => {
  it('states its number in text, locked or not', () => {
    render(<RouteShield value={85} locked label="Mock exam unlocks at 85 percent readiness" />);
    expect(screen.getByRole('img', { name: /unlocks at 85/ })).toHaveClass('shield--locked');
  });
});

describe('ProgressRail', () => {
  it('exposes a labelled progressbar with real values', () => {
    render(<ProgressRail value={7} max={12} label="Session progress: 7 of 12 answered" />);
    const bar = screen.getByRole('progressbar', { name: 'Session progress: 7 of 12 answered' });
    expect(bar).toHaveAttribute('aria-valuenow', '7');
    expect(bar).toHaveAttribute('aria-valuemax', '12');
  });
});

describe('TopicMeter (grounding §3)', () => {
  it('states the numbers in text so the rail is never the only carrier', () => {
    render(<TopicMeter name="Railroad crossings" correct={4} total={11} />);
    expect(screen.getByText('Railroad crossings')).toBeInTheDocument();
    expect(screen.getByText('4 / 11 · 36%')).toBeInTheDocument();
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('hides the decorative rail from assistive tech', () => {
    const { container } = render(<TopicMeter name="Right-of-way" correct={9} total={17} />);
    expect(container.querySelector('.meter__bar')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    [9, 10, 'rail'],
    [6, 10, 'rail--warn'],
    [4, 10, 'rail--stop'],
  ])('bands %i/%i onto %s', (correct, total, cls) => {
    const { container } = render(<TopicMeter name="Topic" correct={correct} total={total} />);
    expect(container.querySelector('.meter__bar')).toHaveClass(cls);
  });
});

describe('StatTile', () => {
  it('pairs a tabular value with an uppercase label', () => {
    render(<StatTile value="248" label="Questions answered" />);
    expect(screen.getByText('248')).toHaveClass('tile__val');
    expect(screen.getByText('Questions answered')).toHaveClass('tile__lab');
  });
});

/* -------------------------------------------------- exam pressure instruments */

describe('Timer', () => {
  it('renders mm:ss with a label', () => {
    render(<Timer secondsRemaining={2730} />);
    expect(screen.getByText('45:30')).toBeInTheDocument();
    expect(screen.getByText('Time left')).toBeInTheDocument();
  });

  it('warns in the last five minutes with a word, not only a colour', () => {
    const { container } = render(<Timer secondsRemaining={120} />);
    expect(container.querySelector('.timer')).toHaveClass('timer--low');
    expect(screen.getByText('Time left · under 5 min')).toBeInTheDocument();
  });
});

describe('StrikeCounter (the TN 7-wrong rule)', () => {
  it('is glanceable as text as well as pips', () => {
    const { container } = render(<StrikeCounter used={2} />);
    expect(screen.getByText('2 / 7 wrong')).toBeInTheDocument();
    expect(container.querySelectorAll('.strikes__pip')).toHaveLength(7);
    expect(container.querySelectorAll('.strikes__pip--used')).toHaveLength(2);
  });

  it('never renders more used pips than the limit', () => {
    const { container } = render(<StrikeCounter used={9} />);
    expect(container.querySelectorAll('.strikes__pip--used')).toHaveLength(7);
  });
});

describe('VerdictSign', () => {
  it.each([
    ['pass', 'plaque--pass', 'Passed'],
    ['short', 'plaque--short', 'Not yet'],
    ['halted', 'plaque--halted', 'Ended early'],
  ] as const)('renders the %s face', (variant, cls, word) => {
    const { container } = render(<VerdictSign variant={variant} score={24} outOf={30} />);
    expect(container.querySelector('.plaque')).toHaveClass(cls);
    expect(screen.getByText(word)).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('is announced as a single readable sentence', () => {
    render(<VerdictSign variant="pass" score={26} outOf={30} />);
    expect(screen.getByRole('img', { name: /26 of 30/ })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------- app states */

describe('EmptyState / ErrorState / LoadingSkeleton', () => {
  it('reads an empty surface as an invitation', () => {
    inRouter(
      <EmptyState
        title="Nothing queued yet"
        body="Answer a few questions and this fills in."
        action={
          <Button variant="guide" to="/study">
            Start studying
          </Button>
        }
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nothing queued yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start studying' })).toBeInTheDocument();
  });

  it('gives an error a recoverable action and an alert role', () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Progress could not be read" body="Details." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Progress could not be read');
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('tells assistive tech the skeleton is a loading state, not content', () => {
    render(<LoadingSkeleton lines={3} label="Loading your progress" />);
    expect(screen.getByRole('status', { name: 'Loading your progress' })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------ Toast, Dialog */

describe('Toast', () => {
  it('is a polite live region with a dismiss control', async () => {
    const onDismiss = vi.fn();
    render(
      <ToastDock>
        <Toast tone="guide" title="Saved offline" onDismiss={onDismiss}>
          Your answer is stored on this device.
        </Toast>
      </ToastDock>,
    );
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Saved offline');
    expect(live).toHaveAttribute('aria-live', 'polite');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('Dialog (practices A16)', () => {
  it('is a native <dialog>, labelled by its own heading', () => {
    const { container } = render(
      <Dialog open title="End this exam?" onClose={() => {}}>
        <p>Body</p>
      </Dialog>,
    );
    const dialog = container.querySelector('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'End this exam?' })).toBeInTheDocument();
  });

  // Escape on a native modal dialog fires `close` in the browser; jsdom does
  // not implement that key handling, so the contract asserted here is that the
  // component reacts to `close` however it was raised.
  it('reports every close, including the one Escape raises', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open title="End this exam?" onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );
    const dialog = container.querySelector('dialog')!;
    dialog.dispatchEvent(new Event('close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing at all when closed', () => {
    const { container } = render(
      <Dialog open={false} title="End this exam?" onClose={() => {}}>
        <p>Body</p>
      </Dialog>,
    );
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBeFalsy();
  });
});

/* --------------------------------------------------------- nav and app bar */

describe('AppNav (grounding §4)', () => {
  it('offers exactly the four destinations, labelled', () => {
    inRouter(<AppNav />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent?.trim())).toEqual([
      'Study',
      'Exam',
      'Signs',
      'Progress',
    ]);
  });

  it('marks the current destination with aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/signs']}>
        <AppNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Signs' })).toHaveAttribute('aria-current', 'page');
  });

  it('owns the brand block, so no page header has to render it', () => {
    inRouter(<AppNav />);
    expect(screen.getByText('TN Drive').closest('.railbrand')).toBeTruthy();
  });
});

describe('AppBar (grounding §3)', () => {
  it('is [back · title · context] —— offline badge, and never the brand', () => {
    inRouter(<AppBar title="Signs" context="84 signs · MUTCD" backTo="/study" />);
    expect(screen.getByRole('link', { name: /Back/ })).toHaveAttribute('href', '/study');
    expect(screen.getByText('Signs')).toHaveClass('appbar__title');
    expect(screen.getByText('84 signs · MUTCD')).toHaveClass('appbar__sub');
    expect(screen.getByText(/Offline ready/)).toBeInTheDocument();
    expect(screen.queryByText('TN Drive')).toBeNull();
  });
});

describe('OfflineBadge', () => {
  it('says it works without a connection', () => {
    render(<OfflineBadge />);
    expect(screen.getByText('Offline ready')).toHaveClass('badge');
  });

  it('says so plainly when the device is actually offline', () => {
    render(<OfflineBadge online={false} />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});

describe('CitationLink', () => {
  it('links to the rule reference and states the page in text', () => {
    inRouter(<CitationLink to="/rules/school-buses" section="Sharing the Road" pdfPage={79} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/rules/school-buses');
    expect(link).toHaveTextContent('Sharing the Road · PDF p. 79');
  });
});

describe('VisuallyHidden', () => {
  it('is in the accessibility tree but not the layout', () => {
    render(<VisuallyHidden>Answered correctly</VisuallyHidden>);
    expect(screen.getByText('Answered correctly')).toHaveClass('sr-only');
  });
});

/* ---------------------------------------------------------- form vocabulary */

describe('DateField (grounding §3)', () => {
  it('gives every segment its own visible label', () => {
    render(<DateField legend="When is your test?" value="" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'When is your test?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
  });

  it('uses no native date control anywhere', () => {
    const { container } = render(<DateField legend="When?" value="" onChange={() => {}} />);
    expect(container.querySelector('input[type="date"]')).toBeNull();
    for (const input of container.querySelectorAll('input')) {
      expect(input).toHaveAttribute('inputmode', 'numeric');
    }
  });

  it('echoes the resolved date in a live region', () => {
    render(<DateField legend="When?" value="2026-09-12" onChange={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saturday, September 12, 2026');
  });

  it('reports each edit as an ISO date the caller can store', async () => {
    const onChange = vi.fn();
    render(<DateField legend="When?" value="2026-09-12" onChange={onChange} />);
    const day = screen.getByLabelText('Day');
    await userEvent.clear(day);
    await userEvent.type(day, '13');
    expect(onChange).toHaveBeenLastCalledWith('2026-09-13');
  });
});

describe('ConfirmGate (grounding §3)', () => {
  it('is a real checkbox with a real label association', async () => {
    const onChange = vi.fn();
    render(<ConfirmGate checked={false} onChange={onChange}>I understand this erases everything.</ConfirmGate>);
    const box = screen.getByRole('checkbox', { name: /erases everything/ });
    expect(box).toHaveAttribute('type', 'checkbox');
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Chip', () => {
  it('carries its pressed state as a tick, not only a fill', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <Chip pressed={false} onToggle={onToggle}>
        Warning
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Warning' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip.querySelector('.chip__tick')).toBeNull();
    await userEvent.click(chip);
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(
      <Chip pressed onToggle={onToggle}>
        Warning
      </Chip>,
    );
    expect(screen.getByRole('button', { name: 'Warning' }).querySelector('.chip__tick')).toBeTruthy();
  });
});

describe('SearchField', () => {
  it('has a programmatic label even when it is not drawn', async () => {
    const onChange = vi.fn();
    render(<SearchField label="Search signs" value="" onChange={onChange} />);
    const input = screen.getByRole('searchbox', { name: 'Search signs' });
    await userEvent.type(input, 'y');
    expect(onChange).toHaveBeenCalledWith('y');
  });

  it('offers a clear control only when there is something to clear', () => {
    const { rerender } = render(<SearchField label="Search" value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    rerender(<SearchField label="Search" value="yield" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });
});

describe('SwitchRow', () => {
  it('writes its state in words beside the track', async () => {
    const onChange = vi.fn();
    render(
      <SwitchRow
        name="Reduce motion"
        description="Turn off every transition."
        checked
        onChange={onChange}
      />,
    );
    const sw = screen.getByRole('switch', { name: /Reduce motion/ });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('On')).toBeInTheDocument();
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('SegmentedField', () => {
  it('is a real radio group', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedField
        legend="Drill asks for"
        name="drill-mode"
        value="meaning"
        onChange={onChange}
        options={[
          { value: 'meaning', label: 'Meaning' },
          { value: 'shape', label: 'Shape & color' },
        ]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Drill asks for' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Meaning' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Shape & color' }));
    expect(onChange).toHaveBeenCalledWith('shape');
  });
});

/* -------------------------------------------------------------- FocusChrome */

describe('FocusChrome (grounding §4)', () => {
  it('hides the nav offset itself and offers an explicit exit', async () => {
    const onExit = vi.fn();
    const { container } = render(
      <FocusChrome
        exitLabel="End session"
        onExit={onExit}
        progress={{ value: 7, max: 12, label: 'Session progress: 7 of 12 answered' }}
        marker={{ index: 7, total: 12 }}
        action={<Button variant="guide">Next question</Button>}
      >
        <p>Question body</p>
      </FocusChrome>,
    );
    expect(container.querySelector('.shell--focus')).toBeTruthy();
    expect(container.querySelector('.nav')).toBeNull();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(onExit).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Next question' }).closest('.actionbar')).toBeTruthy();
  });
});
