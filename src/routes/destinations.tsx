import { Button, SignPanel } from '~/components';
import { Placeholder } from './Placeholder';
import { DEFAULT_SESSION_SIZE } from '~/domain/session';

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

export function ExamRoute() {
  return (
    <Placeholder
      title="Mock exam"
      context="30 questions · 60 minutes · 24 to pass"
      heading="Exam"
      lede="A faithful simulation: thirty questions, sixty minutes, and seven wrong ends it early — same as the real one."
      owner="P5 builds the exam simulator and the three score reports."
    />
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
