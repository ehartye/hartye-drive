import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdvanceFocus } from '~/app/useAdvanceFocus';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, ChoiceRow, Dialog, FocusChrome, SignPanel, SignSvg } from '~/components';
import { IconArrowRight } from '~/components/Icon';
import { usePageTitle } from '~/app/usePageTitle';
import { allSigns } from '~/signs/signs';
import { colorLabel, shapeLabel } from '~/signs/registry';
import type { SignEntry } from '~/signs/registry';
import { describeReview } from '~/domain/scheduler';
import { DEFAULT_DRILL_SIZE, buildDrill, isDrillMode } from '~/domain/sign-drill';
import type { DrillMode, DrillPlan } from '~/domain/sign-drill';
import { useSignStore } from '~/store/signs';
import {
  SIGN_CATEGORIES,
  categoryLabel,
  categoryLesson,
  categoryMeta,
} from './signs/categories';
import { SignRecordTroubleLine } from './signs/parts';

/* ------------------------------------------------------------------- copy */

const PROMPT: Record<DrillMode, string> = {
  meaning: 'What does this sign mean?',
  'shape-color': 'What is this shape and color telling you?',
};

const HINT: Record<DrillMode, string> = {
  meaning: "Pick one. You'll see the rule either way.",
  'shape-color': 'Before you read a word of it — what kind of sign is this?',
};

const MODE_LABEL: Record<DrillMode, string> = {
  meaning: 'Meaning',
  'shape-color': 'Shape & color',
};

const MODES: readonly DrillMode[] = ['meaning', 'shape-color'];

interface Answered {
  chosenIndex: number | null;
  correct: boolean;
  /** The scheduler's own sentence about what happens to this sign next. */
  sentence: string;
}

/**
 * The sign drill.
 *
 * One sign, at hero scale, with **no text label anywhere near it** — the sign
 * is the subject of the screen, and naming it would answer the question. Its
 * accessible name is `SignSvg`'s drill name: shape and colour, never the
 * meaning (practices A8, enforced by `npm run audit:signs`).
 *
 * Everything about *which* sign and *when it comes back* is `src/domain/`:
 * `buildDrill` over `buildSession` over the same Leitner ladder the study
 * session uses. This file renders and records, and nothing more.
 */
export function SignsDrill() {
  usePageTitle('Sign drill');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);

  const answerSign = useSignStore((s) => s.answerSign);
  const finishDrill = useSignStore((s) => s.finishDrill);
  const storageMode = useSignStore((s) => s.storageMode);
  const storageStatus = useSignStore((s) => s.storageStatus);

  const modeParam = params.get('mode');
  const mode: DrillMode = isDrillMode(modeParam) ? modeParam : 'meaning';
  const categoryParam = params.get('cat');
  const category = categoryParam && categoryMeta(categoryParam) ? categoryParam : null;
  const size = Number(params.get('n')) || DEFAULT_DRILL_SIZE;
  const seedParam = params.get('seed');

  /* The line-up is laid out once. It must not be rebuilt when the store
     changes, or answering a sign would reshuffle the drill underneath the
     learner — so the record is read imperatively here rather than subscribed to. */
  const plan: DrillPlan = useMemo(() => {
    const { record } = useSignStore.getState();
    const pool = category ? allSigns.filter((sign) => sign.category === category) : allSigns;
    return buildDrill({
      signs: pool.map((sign) => ({
        id: sign.id,
        category: sign.category,
        meaning: sign.meaning,
        faceColor: sign.faceColor,
        legendColor: sign.legendColor,
        shape: sign.shape,
      })),
      cards: record.cards,
      categories: record.categories,
      now: Date.now(),
      size,
      // A fresh seed per visit, so two drills in a row are not the same thirty
      // signs; `?seed=` pins it for tests and reviewers.
      seed: Number(seedParam) || Date.now(),
      mode,
      lessonFor: categoryLesson,
      // Always all seven, even when the drill is filtered to one category —
      // otherwise a school-only drill offers one answer and teaches nothing.
      lessonPool: SIGN_CATEGORIES.map((meta) => meta.lesson),
    });
    // `mode` changes the choices, so the plan is genuinely a function of it.
  }, [category, size, seedParam, mode]);

  const byId = useMemo(() => new Map(allSigns.map((sign) => [sign.id, sign])), []);

  const total = plan.items.length;
  const item = plan.items[index];
  const sign: SignEntry | undefined = item ? byId.get(item.signId) : undefined;

  /* Switching mode mid-drill rebuilds the choices, so the position resets
     rather than pointing at an answer the learner never saw. */
  const seenMode = useRef(mode);
  useEffect(() => {
    if (seenMode.current === mode) return;
    seenMode.current = mode;
    setIndex(0);
    setAnswered(null);
    setCorrectCount(0);
    setFinished(false);
  }, [mode]);

  /* A route change inside the drill must not leave focus on the choice the
     learner just pressed, three screens down the page. */
  const stageRef = useAdvanceFocus<HTMLDivElement>(index);

  const record = useCallback(
    (chosenIndex: number | null, correct: boolean) => {
      if (!item || !sign) return;
      const { before, after } = answerSign({
        signId: sign.id,
        category: sign.category,
        correct,
        at: Date.now(),
      });
      setAnswered({ chosenIndex, correct, sentence: describeReview(before, after, correct) });
      if (correct) setCorrectCount((n) => n + 1);
    },
    [item, sign, answerSign],
  );

  const onChoose = useCallback(
    (chosenIndex: number) => {
      if (!item || answered) return;
      record(chosenIndex, chosenIndex === item.correctIndex);
    },
    [item, answered, record],
  );

  /* A / B / C and 1 / 2 / 3 answer, so a keyboard learner never has to tab past
     the choices they have already ruled out (practices A4). */
  useEffect(() => {
    if (!item || answered) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      const letters = item.options.map((option) => option.letter.toLowerCase());
      const byLetter = letters.indexOf(key);
      const byNumber = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      const picked = byLetter >= 0 ? byLetter : byNumber;
      if (picked < 0 || picked >= item.options.length) return;
      event.preventDefault();
      onChoose(picked);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [item, answered, onChoose]);

  const exit = () => {
    void navigate('/signs');
  };

  const setMode = (next: DrillMode) => {
    const patch = new URLSearchParams(params);
    patch.set('mode', next);
    setParams(patch, { replace: true });
  };

  if (finished || total === 0) {
    return (
      <DrillComplete
        total={total}
        correct={correctCount}
        weakest={plan.weakestCategories}
        category={category}
        onExit={exit}
      />
    );
  }

  if (!item || !sign) {
    return (
      <FocusChrome exitLabel="Back to Signs" onExit={exit}>
        <h1>That sign is missing</h1>
        <p className="dim mt-2 text-[0.9375rem]">
          The drill referred to a sign that is not in this build of the registry.
        </p>
        <div className="mt-5">
          <Button variant="guide" to="/signs">
            Back to the sign library
          </Button>
        </div>
      </FocusChrome>
    );
  }

  const answeredCount = index + (answered ? 1 : 0);
  const correctLetter = item.options[item.correctIndex]?.letter ?? '—';
  const remaining = total - index - 1;

  const announcement = answered
    ? answered.chosenIndex === null
      ? `Skipped. The right answer is ${correctLetter}. This sign is queued to come back.`
      : answered.correct
        ? `Correct. ${correctLetter} is the right answer.`
        : `Incorrect. You chose ${item.options[answered.chosenIndex]?.letter ?? '—'}. The right answer is ${correctLetter}.`
    : '';

  const goNext = () => {
    if (index + 1 >= total) {
      finishDrill(Date.now());
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setAnswered(null);
  };

  return (
    <>
      <FocusChrome
        exitLabel="End drill"
        onExit={() => {
          setConfirmingExit(true);
        }}
        marker={{ index: index + 1, total, unit: 'Sign' }}
        progress={{
          value: answeredCount,
          max: total,
          label: `Drill progress: ${String(answeredCount)} of ${String(total)} signs answered`,
        }}
        statusRow={
          <>
            <span className="dim text-[0.8125rem]">
              {'Sign '}
              <span className="num text-sign-white font-bold">{index + 1}</span>
              {' of '}
              <span className="num">{total}</span>
              {' · '}
              <span className="num text-sign-white font-bold">{correctCount}</span>
              {' right so far'}
            </span>
            {/* Deliberately quiet: this is a setting, not the subject. */}
            <span className="modes" role="group" aria-label="What the drill asks you for">
              {MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => {
                    setMode(option);
                  }}
                >
                  {MODE_LABEL[option]}
                </button>
              ))}
            </span>
          </>
        }
        action={
          answered ? (
            <>
              <Button variant="guide" block onClick={goNext}>
                {index + 1 >= total ? 'Finish drill' : 'Next sign'}
                <IconArrowRight size={18} />
              </Button>
              <p className="faint text-[0.75rem] text-center mt-2.5">
                {remaining === 0
                  ? 'Last sign in this drill'
                  : `${String(remaining)} sign${remaining === 1 ? '' : 's'} left in this drill`}
              </p>
            </>
          ) : undefined
        }
      >
        <div ref={stageRef} tabIndex={-1} data-sign-drill={sign.id}>
          {/* Above the stage, not below it: a learner drilling into a record
              that cannot be written is spending the session for nothing, and
              the way out is one press away (state-matrix note 6). */}
          <SignRecordTroubleLine status={storageStatus} />

          {/* THE STAGE. One sign, on a post, lit by headlights. No text label —
              the name and the meaning are the question. */}
          <section className="stage" aria-labelledby="drill-ask">
            <SignSvg id={sign.id} size="hero" mode="drill" />
            <span className="stage__post" aria-hidden="true" />
            <span className="stage__ground" aria-hidden="true" />
            <h1 className="stem ask" id="drill-ask">
              {PROMPT[mode]}
            </h1>
            <p className="ask__hint">{HINT[mode]}</p>
          </section>

          <div className="choices">
            {item.options.map((option, optionIndex) => (
              <ChoiceRow
                key={option.letter}
                letter={option.letter}
                state={choiceState(optionIndex, item.correctIndex, answered)}
                picked={answered?.chosenIndex === optionIndex}
                disabled={answered !== null}
                onSelect={() => {
                  onChoose(optionIndex);
                }}
              >
                {option.text}
              </ChoiceRow>
            ))}
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>

          {answered ? (
            <SignPanel
              as="section"
              variant={answered.correct ? 'guide' : 'warn'}
              className="mt-5"
            >
              <p
                className={`eyebrow ${answered.correct ? 'eyebrow--guide' : 'eyebrow--warning'}`}
              >
                {answered.chosenIndex === null
                  ? 'Skipped — queued to come back'
                  : answered.correct
                    ? 'Correct'
                    : `Not quite — the answer is ${correctLetter}`}
              </p>
              <p className="dim text-[0.875rem] m-0">
                {`${shapeLabel(sign.shape)}, ${colorLabel(sign.faceColor)} · ${categoryLabel(sign.category)} · ${sign.mutcd}`}
              </p>
              <p className="read text-[1rem] mt-2.5">
                <strong className="font-ui">{sign.name}</strong>
                {` — ${sign.meaning}`}
              </p>
              <div className="cite mt-3.5">
                <p className="cite__quote">{`“${sign.citation.quote}”`}</p>
                <p className="cite__src">
                  {`Tennessee Comprehensive Driver License Manual · PDF p. ${String(sign.citation.pdfPage)} · printed p. ${String(sign.citation.printedPage)}`}
                </p>
              </div>
              <p className="dim text-[0.8125rem] mt-3.5 mb-0">{answered.sentence}</p>
            </SignPanel>
          ) : (
            <>
              <div className="skip">
                <Button
                  variant="quiet"
                  onClick={() => {
                    record(null, false);
                  }}
                >
                  Skip — I haven&rsquo;t learned this one
                </Button>
              </div>
              <p className="faint text-[0.75rem] text-center mt-6 mb-12 leading-normal">
                Signs are drawn to MUTCD shape and color.
                <br />
                Sourced from the Tennessee Comprehensive Driver License Manual.
              </p>
            </>
          )}

          {storageMode === 'session-only' && (
            <p className="faint text-[0.75rem] text-center mt-5">
              This device is not letting the app save progress, so this drill will not be remembered.
            </p>
          )}
        </div>
      </FocusChrome>

      <Dialog
        open={confirmingExit}
        title="End this drill?"
        onClose={() => {
          setConfirmingExit(false);
        }}
        actions={
          <>
            <Button
              variant="quiet"
              onClick={() => {
                setConfirmingExit(false);
              }}
            >
              Keep drilling
            </Button>
            <Button variant="danger" onClick={exit}>
              End drill
            </Button>
          </>
        }
      >
        <p className="dim text-[0.9375rem]">
          {`You have answered ${String(answeredCount)} of ${String(total)}. Every sign so far is already saved, and anything you missed is already queued to come back — you just lose the rest of this drill's line-up.`}
        </p>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------- sub-screens */

interface DrillCompleteProps {
  total: number;
  correct: number;
  weakest: string[];
  category: string | null;
  onExit: () => void;
}

function DrillComplete({ total, correct, weakest, category, onExit }: DrillCompleteProps) {
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return (
    <FocusChrome
      exitLabel="Back to Signs"
      onExit={onExit}
      progress={{ value: total, max: Math.max(total, 1), label: 'Drill complete' }}
      action={
        <Button variant="guide" block to="/signs">
          Back to the sign library
        </Button>
      }
    >
      {total === 0 ? (
        <>
          <p className="eyebrow">Sign drill</p>
          <h1 className="mt-2">There is nothing to drill here</h1>
          <p className="dim mt-2 text-[0.9375rem]">
            {category
              ? `The ${categoryLabel(category).toLowerCase()} filter matched no signs in the registry.`
              : 'The sign registry loaded but held no signs.'}
          </p>
        </>
      ) : (
        <>
          <p className="eyebrow eyebrow--guide">Drill complete</p>
          <h1 className="mt-2">{`${String(correct)} of ${String(total)} right`}</h1>
          <p className="dim mt-2 text-[0.9375rem]">
            {percent >= 80
              ? 'That is knowledge-test pace. Signs you got right stretch out on their own; the ones you missed come back first.'
              : 'Everything you missed is already queued to come back — first in about ten minutes, then tomorrow.'}
          </p>
          {weakest.length > 0 && (
            <SignPanel as="section" variant="warn" flat className="mt-5">
              <p className="eyebrow eyebrow--warning">Still your weakest ground</p>
              <p className="dim text-[0.9375rem] m-0">
                {weakest.slice(0, 3).map(categoryLabel).join(' · ')}
              </p>
            </SignPanel>
          )}
        </>
      )}
      <p className="faint text-[0.75rem] text-center mt-8 mb-12">
        Not affiliated with the State of Tennessee.
      </p>
    </FocusChrome>
  );
}

/* ------------------------------------------------------------------ helpers */

function choiceState(
  optionIndex: number,
  correctIndex: number,
  answered: Answered | null,
): 'neutral' | 'correct' | 'incorrect' | 'muted' {
  if (!answered) return 'neutral';
  if (optionIndex === correctIndex) return 'correct';
  if (optionIndex === answered.chosenIndex) return 'incorrect';
  return 'muted';
}
