import { useState } from 'react';
import { Button, Dialog, ErrorState, SignPanel, SignSvg } from '~/components';
import { IconChevronRight } from '~/components/Icon';
import { colorLabel, shapeLabel } from '~/signs/registry';
import type { SignEntry } from '~/signs/registry';
import { SIGN_RECORD_VERSION, masteryPips, masteryTier, tierLabel } from '~/domain/sign-progress';
import type { SignLoadStatus } from '~/domain/sign-progress';
import type { CardState } from '~/domain/scheduler';
import { COLOR_KEY, SIGN_CATEGORIES, categoryLabel, categoryMeta } from './categories';
import type { CategoryMeta } from './categories';

/* ------------------------------------------------ the record cannot be read */

/** The two load results the store quarantines: it will not write over either. */
const isUnreadable = (status: SignLoadStatus): boolean =>
  status === 'corrupt' || status === 'future';

interface TroubleCopy {
  title: string;
  body: string;
  detail: string | undefined;
}

function troubleCopy(status: SignLoadStatus, foundVersion: number | null): TroubleCopy {
  if (status === 'future') {
    return {
      title: 'Your sign record is from a newer version',
      body:
        'It was written by a newer version of TN Drive than the one running here, so this build ' +
        'will not touch it — reading it wrong would be worse than not reading it. The library and ' +
        'the drill work exactly as they should; nothing you learn from here on is being saved.',
      detail:
        foundVersion === null
          ? undefined
          : `on this device: schema ${String(foundVersion)} · this app reads up to schema ${String(SIGN_RECORD_VERSION)}`,
    };
  }
  return {
    title: 'Your sign record can’t be read',
    body:
      'The saved file is damaged, so this build will not write over it — that would destroy ' +
      'whatever is still in there. The library and the drill work exactly as they should; ' +
      'nothing you learn from here on is being saved.',
    detail: undefined,
  };
}

export interface SignRecordTroubleProps {
  status: SignLoadStatus;
  foundVersion: number | null;
  onReset: () => void;
}

/**
 * State-matrix cell 8-error, and its note 6: a corrupt or future-version
 * payload must **offer a recoverable path**, never a white screen. Degrading
 * quietly into a working library was only half of that — it left a learner
 * whose mastery had silently stopped being recorded with nothing to read and
 * nothing to press. This is the other half, and it is the same bargain the
 * dashboard strikes: the file on the device is not touched, and the one
 * destructive way out is behind a confirmation.
 */
export function SignRecordTrouble({ status, foundVersion, onReset }: SignRecordTroubleProps) {
  const [confirming, setConfirming] = useState(false);
  if (!isUnreadable(status)) return null;
  const copy = troubleCopy(status, foundVersion);

  return (
    <>
      <ErrorState
        title={copy.title}
        body={copy.body}
        {...(copy.detail === undefined ? {} : { detail: copy.detail })}
        onRetry={() => {
          setConfirming(true);
        }}
        retryLabel="Start a fresh sign record"
        secondaryAction={
          <Button
            variant="quiet"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload and try reading it again
          </Button>
        }
      />
      <Dialog
        open={confirming}
        tone="stop"
        title="Erase the unreadable sign record?"
        onClose={() => {
          setConfirming(false);
        }}
        actions={
          <>
            <Button
              variant="quiet"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep it as it is
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                onReset();
              }}
            >
              Erase it and start over
            </Button>
          </>
        }
      >
        <p className="dim text-[0.9375rem]">
          This deletes the file this build cannot read and starts a clean one, so the drill can
          record again. Whatever mastery is inside it is lost — your questions, your exams and every
          sign in the library are stored separately and are not affected.
        </p>
      </Dialog>
    </>
  );
}

/**
 * The same fact, said in the drill's focus mode, where a full error state would
 * push the sign the learner is meant to be looking at off the screen. The way
 * out lives in the library, so this points at it rather than repeating it.
 */
export function SignRecordTroubleLine({ status }: { status: SignLoadStatus }) {
  if (!isUnreadable(status)) return null;
  return (
    <SignPanel as="section" variant="stop" flat className="mb-5">
      <p className="eyebrow eyebrow--stop mb-1.5">Not being saved</p>
      <p className="dim text-[0.875rem] m-0" role="alert">
        {status === 'future'
          ? 'Your sign record was written by a newer version of TN Drive, so this build will not touch it. This drill is not being saved.'
          : 'Your sign record can’t be read, so this build will not write over it. This drill is not being saved.'}
      </p>
      <div className="mt-3">
        <Button variant="quiet" to="/signs">
          Fix the sign record
        </Button>
      </div>
    </SignPanel>
  );
}

/* ---------------------------------------------------------------- mastery */

const PIP_SLOTS = [0, 1, 2];

export function MasteryBadge({ card }: { card: CardState | undefined }) {
  const tier = masteryTier(card);
  const lit = masteryPips(card);
  return (
    <span className={`mastery mastery--${tier}`}>
      {PIP_SLOTS.map((slot) => (
        <span key={slot} className={slot < lit ? 'pip is-on' : 'pip'} aria-hidden="true" />
      ))}
      {/* The word is the reading; the pips are decoration on top of it (§5). */}
      <span className="mastery__lab">{tierLabel(tier)}</span>
    </span>
  );
}

/* ------------------------------------------------------------- sign card */

export interface SignCardProps {
  sign: SignEntry;
  card: CardState | undefined;
  onOpen: (id: string) => void;
}

/**
 * One sign in the grid.
 *
 * The face is rendered in **drill mode on purpose**: that name is "shape,
 * colour", and the card's own text already says the name and the meaning. The
 * button's accessible name therefore reads shape, colour, name, meaning and
 * mastery — everything a sighted learner gets from the card, in the order the
 * library argues a driver reads a sign (practices A8).
 */
export function SignCard({ sign, card, onOpen }: SignCardProps) {
  return (
    <button
      type="button"
      className="signcard"
      data-sign={sign.id}
      onClick={() => {
        onOpen(sign.id);
      }}
    >
      <span className="signcard__face">
        <SignSvg id={sign.id} size="lg" mode="drill" />
      </span>
      <span className="signcard__name">{sign.name}</span>
      <span className="signcard__mean">{sign.meaning}</span>
      <MasteryBadge card={card} />
    </button>
  );
}

/* -------------------------------------------------------- category header */

export interface CategoryHeadProps {
  meta: CategoryMeta;
  shown: number;
  total: number;
  headingId: string;
}

/** The rule, stated as a lesson rather than a label. That is the whole point. */
export function CategoryHead({ meta, shown, total, headingId }: CategoryHeadProps) {
  return (
    <div className="cat__head">
      <div className="cat__row">
        <h2 id={headingId}>{meta.label}</h2>
        <span className="cat__count num">
          {shown === total ? `${String(total)} sign${total === 1 ? '' : 's'}` : `${String(shown)} of ${String(total)}`}
        </span>
      </div>
      <p className="cat__rule">{meta.rule}</p>
    </div>
  );
}

/* ------------------------------------------------------------- colour key */

/** Colour arrives first, shape second, words last. Taught in that order. */
export function ColorKey() {
  return (
    <section className="panel" aria-labelledby="colour-key">
      <h2 id="colour-key" className="text-[1.0625rem] mb-3.5">
        Color is the first thing you read
      </h2>
      <ul className="keylist">
        {COLOR_KEY.map((entry) => (
          <li key={entry.signId}>
            <SignSvg id={entry.signId} size="sm" decorative />
            <p>
              <b>{entry.term}</b>
              {` — ${entry.text}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- recovery links */

export interface CategoryLinksProps {
  counts: Record<string, number>;
  onPick: (category: string) => void;
}

/** The way out of an empty filter: a real destination, not "no results". */
export function CategoryLinks({ counts, onPick }: CategoryLinksProps) {
  return (
    <div>
      {SIGN_CATEGORIES.map((meta) => (
        <button
          key={meta.id}
          type="button"
          className={`catlink catlink--${meta.id}`}
          onClick={() => {
            onPick(meta.id);
          }}
        >
          <SignSvg id={meta.exemplar} size="sm" decorative />
          <span className="catlink__t">
            <span className="catlink__n">{meta.label}</span>
            <span className="catlink__s">{meta.blurb}</span>
          </span>
          <span className="catlink__c num">{counts[meta.id] ?? 0}</span>
          <IconChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ sign detail */

export interface SignDetailProps {
  sign: SignEntry | undefined;
  card: CardState | undefined;
  onClose: () => void;
}

/**
 * What is behind a sign card: the meaning in full, the shape and colour said
 * out loud, and **the manual's own words with a page number**. The citation is
 * the product's promise — a learner should never have to take this app's word
 * for anything (practices D1).
 */
export function SignDetail({ sign, card, onClose }: SignDetailProps) {
  const meta = sign ? categoryMeta(sign.category) : undefined;
  return (
    <Dialog
      open={sign !== undefined}
      title={sign?.name ?? ''}
      onClose={onClose}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          {sign && (
            <Button variant="guide" to={`/signs/drill?cat=${encodeURIComponent(sign.category)}`}>
              {`Drill ${meta?.label.toLowerCase() ?? 'these'} signs`}
            </Button>
          )}
        </>
      }
    >
      {sign && (
        <div className="signdetail">
          <div className="signdetail__top">
            <SignSvg id={sign.id} size="lg" mode="drill" />
            <div className="signdetail__facts">
              <p className="eyebrow mb-1">{`${categoryLabel(sign.category)} · ${sign.mutcd}`}</p>
              <p className="dim text-[0.875rem] m-0">
                {`${shapeLabel(sign.shape)}, ${colorLabel(sign.faceColor)}`}
              </p>
              <p className="mt-2 m-0">
                <MasteryBadge card={card} />
              </p>
            </div>
          </div>

          <p className="read text-[1rem] mt-4">{sign.meaning}</p>

          <div className="cite mt-4">
            <p className="cite__quote">{`“${sign.citation.quote}”`}</p>
            <p className="cite__src">
              {`Tennessee Comprehensive Driver License Manual · PDF p. ${String(sign.citation.pdfPage)} · printed p. ${String(sign.citation.printedPage)}`}
            </p>
          </div>

          {sign.meaningSource && (
            <p className="faint text-[0.75rem] mt-3 leading-normal">
              {`The manual shows this sign without describing it in prose, so the meaning above is taken from ${sign.meaningSource.reference}.`}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
