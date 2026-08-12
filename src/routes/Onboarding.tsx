import { useState } from 'react';
import { Button, DateField, SignPanel, SignSvg, VisuallyHidden } from '~/components';
import {
  IconArrowRight,
  IconBook,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconRefresh,
  IconX,
} from '~/components/Icon';
import { usePageTitle } from '~/app/usePageTitle';
import { dailyPace, daysUntilTest } from '~/domain/setup';
import type { StudyGoal } from '~/domain/setup';
import { useSetupStore } from '~/store/setup';
import { useContent, formatDay } from './dashboard/support';
import { SourceFooter } from './dashboard/parts';

/**
 * First run (state-matrix cell 1) and the one failure that genuinely happens on
 * it (cell 1-error, storage blocked).
 *
 * Two questions, because two are all that change what the app does. The third
 * panel is not a question: the no-account / works-offline / nothing-leaves-your-
 * phone promise is a **feature**, so it gets a motorist-services sign of its
 * own rather than a line of small print at the bottom.
 */
export function Onboarding() {
  usePageTitle('Study');

  const content = useContent();
  const setup = useSetupStore((s) => s.setup);
  const storageMode = useSetupStore((s) => s.storageMode);
  const save = useSetupStore((s) => s.save);
  const acceptSessionOnly = useSetupStore((s) => s.acceptSessionOnly);
  const recheckStorage = useSetupStore((s) => s.recheckStorage);

  const [goal, setGoal] = useState<StudyGoal>(setup.goal);
  const [testDate, setTestDate] = useState<string>(setup.testDate ?? '');
  const [blocked, setBlocked] = useState(storageMode === 'session-only');
  const [today] = useState(() => Date.now());

  const bankSize = content.status === 'ready' ? content.content.bankSize : null;
  const signCount = content.status === 'ready' ? content.content.signCount : null;

  const submit = () => {
    if (storageMode === 'session-only') {
      // Nothing was lost — nothing has been answered yet — but the learner is
      // owed the truth before they start (practices C5).
      setBlocked(true);
      return;
    }
    save({ goal, testDate: testDate || null, at: Date.now() });
  };

  if (blocked) {
    return (
      <StorageUnavailable
        goal={goal}
        testDate={testDate || null}
        bankSize={bankSize}
        signCount={signCount}
        onRecheck={() => {
          if (recheckStorage() === 'ok') {
            save({ goal, testDate: testDate || null, at: Date.now() });
            setBlocked(false);
          }
        }}
        onContinue={() => {
          acceptSessionOnly();
        }}
      />
    );
  }

  const days = daysUntilTest(testDate || null, today);
  const pace = dailyPace(bankSize ?? 0, days);

  return (
    <main className="wrap stack pt-7 pb-10">
      <div className="row gap-2.5">
        <SignSvg id="r1-1-stop" size="sm" decorative />
        <strong className="text-[1.0625rem] tracking-[-0.02em]">TN&nbsp;Drive</strong>
      </div>

      <section className="marquee" aria-labelledby="welcome-head">
        <div className="marquee__face">
          <p className="marquee__legend">Tennessee · Class D</p>
          <h1 className="marquee__title" id="welcome-head">
            Pass the
            <br />
            knowledge test
          </h1>
          <div className="marquee__rule" />
          <div className="marquee__facts">
            <div className="marquee__fact">
              <b>{bankSize === null ? '—' : bankSize}</b>
              <span>Questions</span>
            </div>
            <div className="marquee__fact">
              <b>{signCount === null ? '—' : signCount}</b>
              <span>Signs</span>
            </div>
            <div className="marquee__fact">
              <b>135</b>
              <span>Manual pages</span>
            </div>
          </div>
        </div>
      </section>

      <p className="read">
        Every question quotes the Tennessee driver manual, and every sign is drawn to spec — right
        shape, right color, right proportion. Colors mean on this screen what they mean on the
        road, so you learn the road by living in it.
      </p>

      <hr className="centreline" />

      <fieldset className="field border-0 p-0 m-0 min-w-0">
        <legend className="field__label">
          What are you studying for?
          <small className="block font-normal text-[0.8125rem] mt-1 tracking-normal">
            Sets which questions you get.
          </small>
        </legend>
        <div className="picks">
          <label className="pick">
            <input
              type="radio"
              name="goal"
              value="class-d"
              checked={goal === 'class-d'}
              onChange={() => {
                setGoal('class-d');
              }}
            />
            <span className="pick__dot" aria-hidden="true" />
            <span className="pick__body">
              <span className="pick__t">Class D knowledge test</span>
              <span className="pick__s">
                {`All ${bankSize === null ? 'the' : String(bankSize)} questions, all ${signCount === null ? 'the' : String(signCount)} signs, and 30-question mock exams timed like the real one.`}
              </span>
            </span>
            <SignSvg id="w3-3-signal-ahead" size="sm" decorative />
          </label>
          <label className="pick">
            <input
              type="radio"
              name="goal"
              value="signs"
              checked={goal === 'signs'}
              onChange={() => {
                setGoal('signs');
              }}
            />
            <span className="pick__dot" aria-hidden="true" />
            <span className="pick__body">
              <span className="pick__t">Signs refresher</span>
              <span className="pick__s">
                {`The ${signCount === null ? '' : `${String(signCount)} `}signs only — shape, color and meaning. Shorter sessions, no exam simulator.`}
              </span>
            </span>
            <SignSvg id="w1-2-curve" size="sm" decorative />
          </label>
        </div>
      </fieldset>

      <div>
        <DateField
          legend="When is your test? (optional)"
          value={testDate}
          onChange={setTestDate}
          hint="Sets your daily pace. Nothing is scheduled, and nothing reminds you."
        />
        {days !== null && (
          <p className="pace">
            <IconClock size={16} />
            {days > 0 && pace !== null
              ? `${String(days)} days out — about `
              : days === 0
                ? 'Your test is today. Good luck — a short refresher still helps.'
                : 'That date has passed. Change it in Settings whenever you rebook.'}
            {days > 0 && pace !== null && (
              <>
                <b>{`${String(pace)} questions a day`}</b>
                {' to cover the bank.'}
              </>
            )}
          </p>
        )}
      </div>

      <hr className="centreline" />

      <SignPanel as="section" variant="route" aria-labelledby="promise-head">
        <div className="row mb-4">
          <SignSvg id="d9-2-hospital" size="sm" decorative />
          <h2 className="text-[1.125rem]" id="promise-head">
            How this app behaves
          </h2>
        </div>
        <dl className="promise">
          {[
            {
              term: 'No account, ever',
              detail: 'No email, no password, no sign-in. This screen is the whole setup.',
            },
            {
              term: 'Works with no signal',
              detail:
                'Add it to your home screen and every question, sign and explanation opens at zero bytes — in a Driver Services Center parking lot included.',
            },
            {
              term: 'Nothing leaves this phone',
              detail:
                "Your answers stay in this browser's storage. There is no server to send them to and no analytics in the app.",
            },
          ].map((item) => (
            // `dt` and `dd` must be direct children of the wrapping `div` —
            // a second nesting level is invalid inside a `dl` and axe says so.
            <div key={item.term}>
              <span className="tick" aria-hidden="true">
                <IconCheck size={14} />
              </span>
              <dt>{item.term}</dt>
              <dd>{item.detail}</dd>
            </div>
          ))}
        </dl>
      </SignPanel>

      <div>
        <Button variant="guide" block onClick={submit} className="text-[1.0625rem]">
          Start studying
          <IconArrowRight size={18} />
        </Button>
        <p className="dim text-center text-[0.8125rem] mt-2">
          Both answers can be changed later in Settings.
        </p>
      </div>

      <SourceFooter className="mt-6" />
    </main>
  );
}

/* ------------------------------------------------ cell 1-error: no storage */

interface StorageUnavailableProps {
  goal: StudyGoal;
  testDate: string | null;
  bankSize: number | null;
  signCount: number | null;
  onRecheck: () => void;
  onContinue: () => void;
}

/**
 * Private browsing, a full quota or a blocked site-data setting — the one
 * genuinely likely first-run failure (matrix note 2), and the screen X21 lands
 * on.
 *
 * A caution diamond, not an octagon: this is recoverable. It states what
 * session-only mode costs and what it does not, keeps the answers already
 * given, and offers a real way back — never a dead end.
 */
function StorageUnavailable({
  goal,
  testDate,
  bankSize,
  signCount,
  onRecheck,
  onContinue,
}: StorageUnavailableProps) {
  const lost = [
    'Your study streak',
    "Which topics you're weak on",
    'Resuming after you close the tab',
    'Past exam scores',
  ];
  const kept = [
    bankSize === null ? 'Every practice question' : `All ${String(bankSize)} practice questions`,
    signCount === null ? 'Every road sign' : `All ${String(signCount)} road signs`,
    'Full 30-question mock exams',
    'Every manual citation',
  ];

  return (
    <main className="wrap stack pt-7 pb-10">
      <div className="row gap-2.5">
        <SignSvg id="r1-1-stop" size="sm" decorative />
        <strong className="text-[1.0625rem] tracking-[-0.02em]">TN&nbsp;Drive</strong>
      </div>

      <section className="caution" role="alert">
        <SignSvg id="w1-2-curve" size="lg" decorative />
        <div>
          <p className="eyebrow eyebrow--warning">Storage unavailable</p>
          <h1>This browser won&rsquo;t let the app save</h1>
        </div>
      </section>

      <p className="read">
        Private browsing, a full storage quota, or a blocked site-data setting is stopping
        TN&nbsp;Drive from writing to this device. Nothing is broken and nothing was lost — you have
        not answered anything yet. You can study right now in session-only mode, or fix storage and
        keep your progress.
      </p>

      <SignPanel as="section" flat aria-labelledby="carried-head">
        <p className="eyebrow mb-2.5" id="carried-head">
          Your answers so far
        </p>
        <p className="carried">
          <span>
            Studying for{' '}
            <b>{goal === 'signs' ? 'Signs refresher' : 'Class D knowledge test'}</b>
          </span>
          {testDate && (
            <span>
              Test date <b>{formatDay(testDate)}</b>
            </span>
          )}
        </p>
        <p className="dim text-[0.8125rem] mt-3">Kept for this session either way.</p>
      </SignPanel>

      <div className="ledger">
        <SignPanel flat className="ledger--lose">
          <h2 className="text-[0.9375rem] mb-2.5">Session-only mode drops</h2>
          <ul>
            {lost.map((item) => (
              <li key={item}>
                <IconX size={16} />
                {item}
              </li>
            ))}
          </ul>
        </SignPanel>
        <SignPanel flat className="ledger--keep">
          <h2 className="text-[0.9375rem] mb-2.5">Everything else still works</h2>
          <ul>
            {kept.map((item) => (
              <li key={item}>
                <IconCheck size={16} />
                {item}
              </li>
            ))}
          </ul>
        </SignPanel>
      </div>

      <div>
        <Button variant="guide" block onClick={onContinue} className="text-[1.0625rem]">
          Continue in session-only mode
        </Button>
        <div className="mt-3">
          <Button variant="quiet" block onClick={onRecheck}>
            <IconRefresh size={17} />
            Check storage again
          </Button>
        </div>
        <p className="dim text-center text-[0.8125rem] mt-2">
          Progress is kept until you close this tab.
        </p>
      </div>

      <details className="lookup">
        <summary>
          <IconBook size={17} />
          <span className="lookup__label">
            How to let the app save
            <small>Three fixes, by browser</small>
          </span>
          <IconChevronRight size={16} className="lookup__chev" />
        </summary>
        <div className="lookup__body">
          <ol className="read text-[0.9375rem] pl-5 list-decimal grid gap-2">
            <li>
              <b>Safari, private tab:</b> open the same page in a normal tab. Private tabs block
              site storage on purpose.
            </li>
            <li>
              <b>Chrome or Edge:</b> Settings → Privacy → Site settings → Cookies and site data, and
              allow it for this site.
            </li>
            <li>
              <b>Storage full:</b> clear space in Settings → Storage, then press Check storage
              again.
            </li>
          </ol>
          <p className="dim text-[0.8125rem] mt-2">
            The app needs a few megabytes and asks for nothing else.
          </p>
        </div>
      </details>

      <VisuallyHidden>
        Session-only mode keeps everything working for this tab; only what would have been saved is
        lost.
      </VisuallyHidden>

      <SourceFooter className="mt-5" />
    </main>
  );
}
