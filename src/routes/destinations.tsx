import { AppBar, Button, SignPanel } from '~/components';
import { Placeholder } from './Placeholder';
import { usePageTitle } from '~/app/usePageTitle';
import { DEFAULT_SESSION_SIZE } from '~/domain/session';
import {
  EXAM_PASS_MARK,
  EXAM_QUESTION_COUNT,
  EXAM_WRONG_LIMIT,
  REACHABLE_AFTER_WRONG_LIMIT,
} from '~/domain/exam';
import { latestAttempt, openAttempt } from '~/domain/exam-history';
import { useExamStore } from '~/store/exam';

/**
 * The four destinations plus Settings, stood up with real chrome and honest
 * placeholder bodies. P4–P8 replace the bodies; the routes, titles, app bars
 * and nav behaviour are P1's and stay.
 */

export function StudyRoute() {
  return (
    <Placeholder
      title="Study"
      context="Class D knowledge test · offline"
      heading="Study"
      lede="Adaptive practice that returns to whatever you keep getting wrong, with the manual's own words behind every answer."
      owner="P7 builds the dashboard and onboarding that belong on this page. The session button below is P4's way in and is expected to be absorbed by it."
    >
      <SignPanel as="section" variant="guide">
        <p className="eyebrow eyebrow--guide">Adaptive session</p>
        <p className="dim text-[0.9375rem]">
          {`${String(DEFAULT_SESSION_SIZE)} questions, built around whatever you keep getting wrong. Anything you miss comes back in about ten minutes, then tomorrow, then next week.`}
        </p>
        <div className="mt-4">
          <Button variant="guide" block to="/study/session">
            Start a session
          </Button>
        </div>
      </SignPanel>
    </Placeholder>
  );
}

/**
 * The way in to the simulator, and the way back to the last result. The rules
 * are stated here as well as on the briefing screen — a learner should know
 * what they are walking into before they even open it (practices A15).
 */
export function ExamRoute() {
  usePageTitle('Mock exam');
  const record = useExamStore((s) => s.record);
  const previous = latestAttempt(record);
  const open = openAttempt(record) !== null;

  return (
    <>
      <AppBar title="Mock exam" context="30 questions · 60 minutes · 24 to pass" />
      <main className="wrap stack pt-6">
        <div>
          <p className="eyebrow">Class D knowledge test</p>
          <h1>Exam</h1>
          <p className="dim mt-2 text-[0.9375rem]">
            A faithful simulation: thirty questions, sixty minutes, and seven wrong ends it early —
            same as the real one.
          </p>
        </div>

        <SignPanel as="section" variant="guide">
          <p className="eyebrow eyebrow--guide">
            {open ? 'Attempt in progress' : 'The rules, before you start'}
          </p>
          <ul className="dim text-[0.9375rem] grid gap-1.5 m-0 pl-5 list-disc">
            <li>{`${String(EXAM_QUESTION_COUNT)} questions, a quarter each from the four areas the manual publishes.`}</li>
            <li>{`${String(EXAM_PASS_MARK)} correct to pass.`}</li>
            <li>60 minutes, on the clock. It keeps running if you leave.</li>
            <li>{`${String(EXAM_WRONG_LIMIT)} wrong ends it — ${String(EXAM_QUESTION_COUNT)} minus ${String(EXAM_WRONG_LIMIT)} leaves ${String(REACHABLE_AFTER_WRONG_LIMIT)}, under the ${String(EXAM_PASS_MARK)} you need.`}</li>
            <li>No going back, and no verdicts until the report.</li>
          </ul>
          <div className="mt-4">
            <Button variant="guide" block to="/exam/run">
              {open ? 'Resume the exam in progress' : 'Start a mock exam'}
            </Button>
          </div>
        </SignPanel>

        {previous && (
          <SignPanel as="section" flat>
            <p className="eyebrow">Last attempt</p>
            <p className="dim text-[0.9375rem] m-0">
              {`${String(previous.correct)} of ${String(previous.outOf)} · ${
                previous.verdict === 'pass'
                  ? 'passed'
                  : previous.verdict === 'halted'
                    ? 'ended early at seven wrong'
                    : 'did not pass'
              }`}
            </p>
            <div className="mt-4">
              <Button variant="quiet" block to={`/exam/report?a=${encodeURIComponent(previous.id)}`}>
                Open the score report
              </Button>
            </div>
          </SignPanel>
        )}

        <p className="faint text-[0.75rem] text-center leading-normal mt-6">
          A practice result. It is not a state score and carries no official weight.
          <br />
          Not affiliated with the State of Tennessee.
        </p>
      </main>
    </>
  );
}

export function SignsRoute() {
  return (
    <Placeholder
      title="Road signs"
      context="MUTCD shapes, colors and meanings"
      heading="Signs"
      lede="Every sign drawn to spec — correct shape, correct color, correct proportion — with the rule it stands for."
      owner="P3 authors the registry; P6 builds the drill and the browsable library."
    />
  );
}

export function ProgressRoute() {
  return (
    <Placeholder
      title="Progress"
      context="Topic mastery and attempt history"
      heading="Progress"
      lede="Where you are against the exam blueprint, and what is still holding you back."
      owner="P8 builds the progress surface and its hand-authored charts."
    />
  );
}

export function SettingsRoute() {
  return (
    <Placeholder
      title="Settings"
      context="Source, corrections and your data"
      heading="Settings"
      lede="Everything stays on this device. No account, no sync, nothing sent anywhere."
      owner="P8 builds settings, the source disclosure and the guarded reset."
    />
  );
}
