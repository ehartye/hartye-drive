import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppBar,
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
} from '~/components';
import { allSigns } from '~/signs/signs';
import { usePageTitle } from '~/app/usePageTitle';

/**
 * `/gallery` — every primitive in every state, on one page, so the whole design
 * system can be screenshotted and tabbed through at once. It is a development
 * surface, not a destination: it is not in `AppNav`.
 */

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-12" aria-labelledby={id}>
      <div className="spread items-baseline border-b border-shoulder pb-2 mb-5">
        <h2 id={id}>{title}</h2>
        <span className="num faint text-[0.6875rem] uppercase tracking-widest">{id}</span>
      </div>
      {note && <p className="dim text-sm mb-5 max-w-[62ch]">{note}</p>}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="eyebrow">{label}</p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

const CITATION = {
  section: 'Sharing the Road',
  pdfPage: 79,
  printedPage: 65,
  quote:
    'A turn lane in the middle of a four-lane highway is NOT considered a barrier, but a fifth lane that is suitable for vehicular traffic.',
  to: '/gallery',
};

export function Gallery() {
  usePageTitle('Design system');
  const [picked, setPicked] = useState<string | null>('B');
  const [chips, setChips] = useState<Record<string, boolean>>({ Warning: true, Regulatory: false });
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('2026-09-12');
  const [gate, setGate] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [drill, setDrill] = useState('meaning');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dockVisible, setDockVisible] = useState(true);

  return (
    <>
      <AppBar title="Design system" context="Every component, every state · /gallery" />

      <main className="wrap pb-16 pt-6">
        <h1>Design system</h1>
        <p className="dim mt-2 max-w-[62ch] text-[0.9375rem]">
          The interface is the roadway. Every colour below means what it means on a real Tennessee
          road, and the signage system is the one bold move — everything around it stays quiet.
        </p>

        {/* ------------------------------------------------------------ tokens */}
        <Section
          id="tokens"
          title="Colour tokens"
          note="Sign faces use true MUTCD colour. UI text uses the accessible text tokens — different jobs, different tokens. School is fluorescent yellow-green; fluorescent pink is incident management only."
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
            {[
              ['asphalt', 'bg-asphalt'],
              ['asphalt-raised', 'bg-asphalt-raised'],
              ['asphalt-sunk', 'bg-asphalt-sunk'],
              ['shoulder', 'bg-shoulder'],
              ['shoulder-lit', 'bg-shoulder-lit'],
              ['guide', 'bg-guide'],
              ['guide-lit', 'bg-guide-lit'],
              ['guide-deep', 'bg-guide-deep'],
              ['sign-white', 'bg-sign-white'],
              ['warning', 'bg-warning'],
              ['stop', 'bg-stop'],
              ['stop-lit', 'bg-stop-lit'],
              ['work', 'bg-work'],
              ['route', 'bg-route'],
              ['route-lit', 'bg-route-lit'],
              ['school', 'bg-school'],
              ['incident', 'bg-incident'],
            ].map(([name, cls]) => (
              <div key={name} className="rounded-md border border-shoulder overflow-hidden">
                <div className={`${cls ?? ''} h-12`} />
                <p className="num text-[0.6875rem] p-2 dim">{name}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-1.5">
            <p className="text-sign-white">sign-white — primary text</p>
            <p className="dim">sign-dim — secondary text, 7.2:1</p>
            <p className="faint">sign-faint — tertiary text, 4.6:1</p>
            <p className="text-guide-text">guide-text — correct, 7.1:1</p>
            <p className="text-stop-text">stop-text — incorrect, 6.5:1</p>
            <p className="text-work-text">work-text — work zone</p>
            <p className="text-route-text">route-text — informational links</p>
            <p className="text-warning">warning — caution, 12.1:1</p>
          </div>
        </Section>

        {/* -------------------------------------------------------- typography */}
        <Section
          id="type"
          title="Typography"
          note="Overpass is the road — a face derived from FHWA Highway Gothic. Newsreader is the book, and the law. Question stems set in Overpass; explanations set in Newsreader. Both are self-hosted woff2; the app makes zero font requests."
        >
          <p className="eyebrow">Eyebrow · highway sign legend</p>
          {/* Scale specimens, not levels: this page already has its one <h1>. */}
          <p className="type-h1">Heading one</p>
          <p className="type-h2 mt-3">Heading two</p>
          <p className="type-h3 mt-3">Heading three</p>
          <p className="stem mt-5">
            A school bus coming toward you stops, flashes its red lights and swings out its stop
            arm. What must you do?
          </p>
          <div className="read mt-5 max-w-[62ch]">
            <p>
              A center turn lane is paint, not a divider. Tennessee excuses oncoming traffic from
              stopping only where the roadway is separated by a physical barrier or an unpaved
              median.
            </p>
          </div>
          <p className="num mt-5 text-2xl">00:00 · 1234567890 · tabular figures</p>
        </Section>

        {/* -------------------------------------------------------------- signs */}
        <Section
          id="signs"
          title="SignSvg"
          note="P1 seed registry — hand-authored, spec-accurate geometry. P3 grows this to the ≥80 signs the floor requires. Every sign names its shape, colour and meaning; drill mode withholds the meaning."
        >
          <div className="flex flex-wrap gap-6">
            {allSigns.map((sign) => (
              <figure key={sign.id} className="w-[7.5rem] m-0">
                <SignSvg id={sign.id} size="lg" />
                <figcaption className="mt-2">
                  <span className="num text-[0.625rem] faint block">{sign.mutcd}</span>
                  <span className="text-[0.8125rem] dim">{sign.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <Row label="Sizes">
            <SignSvg id="stop" size="sm" decorative />
            <SignSvg id="stop" decorative />
            <SignSvg id="stop" size="lg" decorative />
            <SignSvg id="stop" size="xl" decorative />
          </Row>
          <Row label="Drill mode — the accessible name must not give away the answer">
            <SignSvg id="school-crossing" size="hero" mode="drill" />
          </Row>
        </Section>

        {/* ------------------------------------------------------------- panels */}
        <Section
          id="panels"
          title="SignPanel"
          note="A sign face under headlights: a low-opacity radial sheen plus fine glass-bead grain, pure CSS. Applied to sign artifacts only, never whole pages."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(['plain', 'guide', 'stop', 'warn', 'route'] as const).map((variant) => (
              <SignPanel key={variant} variant={variant}>
                <p className="eyebrow">{variant}</p>
                <p className="dim text-sm">Retroreflective surface.</p>
              </SignPanel>
            ))}
            <SignPanel flat>
              <p className="eyebrow">flat</p>
              <p className="dim text-sm">Sheen and grain removed.</p>
            </SignPanel>
          </div>
        </Section>

        {/* ------------------------------------------------------------ buttons */}
        <Section id="buttons" title="Button">
          <Row label="Variants">
            <Button variant="guide">Continue studying</Button>
            <Button variant="quiet">Take it anyway</Button>
            <Button variant="danger">Erase everything</Button>
          </Row>
          <Row label="Disabled — stays focusable so its reason can be read">
            <Button variant="guide" disabled describedBy="why-disabled">
              Erase everything
            </Button>
            <span id="why-disabled" className="dim text-sm">
              Tick the box first.
            </span>
          </Row>
          <Row label="Block · link">
            <div className="w-full max-w-[22rem] grid gap-2.5">
              <Button variant="guide" block>
                Next question
              </Button>
              <Button variant="quiet" to="/study">
                A link that looks like a button
              </Button>
            </div>
          </Row>
        </Section>

        {/* ------------------------------------------------------------ choices */}
        <Section
          id="choices"
          title="ChoiceRow"
          note="Five states. The picked-verdict-withheld state is achromatic and keyed off aria-pressed, because in exam mode any colour would leak the answer — and it must never override the correct/incorrect verdict."
        >
          <div className="grid gap-2.5 max-w-[38rem]">
            <ChoiceRow letter="A" picked={picked === 'A'} onSelect={() => { setPicked('A'); }}>
              Neutral — click to see the picked state.
            </ChoiceRow>
            <ChoiceRow letter="B" picked={picked === 'B'} onSelect={() => { setPicked('B'); }}>
              Picked, verdict withheld — achromatic on purpose.
            </ChoiceRow>
          </div>
          <div className="grid gap-2.5 max-w-[38rem] mt-4">
            <ChoiceRow letter="A" state="correct" disabled>
              Correct answer, not picked.
            </ChoiceRow>
            <ChoiceRow letter="B" state="correct" picked disabled>
              Correct answer, and the learner picked it.
            </ChoiceRow>
            <ChoiceRow letter="C" state="incorrect" picked disabled>
              Picked, and wrong.
            </ChoiceRow>
            <ChoiceRow letter="D" state="muted" disabled>
              Muted — neither picked nor correct.
            </ChoiceRow>
          </div>
        </Section>

        {/* ------------------------------------------- question + explanation */}
        <Section id="question" title="QuestionCard · ExplanationBlock">
          <QuestionCard
            headingLevel={2}
            eyebrow="Adaptive session"
            topic="Sharing the road · School buses"
            signId="school-crossing"
            stem="You are driving on a four-lane road with a center turn lane. A school bus coming toward you stops and swings out its stop arm. What must you do?"
            announcement="Incorrect. The answer is A."
          >
            <ChoiceRow letter="A" state="correct" disabled>
              Stop, and stay stopped until the stop arm folds in.
            </ChoiceRow>
            <ChoiceRow letter="B" state="muted" disabled>
              Slow to 15 mph and pass with caution.
            </ChoiceRow>
            <ChoiceRow letter="C" state="incorrect" picked disabled>
              Keep driving — the turn lane divides the road.
            </ChoiceRow>
          </QuestionCard>

          <div className="mt-5">
            <ExplanationBlock verdict="incorrect" answerLetter="A" citation={CITATION}>
              <p>
                A center turn lane is paint, not a divider. Tennessee excuses oncoming traffic from
                stopping only where the roadway is separated by a physical barrier or an unpaved
                median.
              </p>
              <p>Barrier or grass, you may go. Paint, you stop.</p>
            </ExplanationBlock>
          </div>
        </Section>

        {/* --------------------------------------------------- markers + meters */}
        <Section id="markers" title="MileMarker · RouteShield · StatTile · ProgressRail · TopicMeter">
          <Row label="MileMarker">
            <MileMarker index={7} total={12} />
            <MileMarker index={30} total={30} />
          </Row>
          <Row label="RouteShield — mastery, not decoration">
            <RouteShield value={72} label="Readiness 72 percent" />
            <RouteShield value={85} locked label="Mock exam unlocks at 85 percent readiness" />
            <RouteShield value={84} size="lg" label="Readiness 84 percent" />
          </Row>
          <Row label="StatTile">
            <div className="grid-tiles w-full max-w-[30rem]">
              <StatTile value="248" label="Answered" />
              <StatTile value="72%" label="Readiness" />
              <StatTile value="6" label="Day streak" />
            </div>
          </Row>
          <div className="mb-6 max-w-[30rem]">
            <p className="eyebrow">ProgressRail</p>
            <ProgressRail value={7} max={12} label="Session progress: 7 of 12 answered" />
            <div className="mt-2">
              <ProgressRail value={6} max={12} tone="warn" label="Six of twelve, needs review" />
            </div>
            <div className="mt-2">
              <ProgressRail value={2} max={12} tone="stop" label="Two of twelve, weak" />
            </div>
          </div>
          <div className="max-w-[30rem]">
            <p className="eyebrow">TopicMeter — ≥80 guide · 50–79 warn · &lt;50 stop</p>
            <TopicMeter name="Traffic signs and signals" correct={22} total={25} note="last seen today" />
            <TopicMeter name="Rules of the road" correct={9} total={17} note="last seen 4 days ago" />
            <TopicMeter name="Railroad crossings" correct={4} total={11} note="last seen today" />
            <TopicMeter name="Work zones" correct={0} total={0} note="not started" />
          </div>
        </Section>

        {/* ---------------------------------------------------------- exam kit */}
        <Section id="exam" title="Timer · StrikeCounter · VerdictSign">
          <Row label="Timer">
            <Timer secondsRemaining={2730} />
            <Timer secondsRemaining={119} />
          </Row>
          <Row label="StrikeCounter — the seven-wrong rule, glanceable">
            <StrikeCounter used={0} />
            <StrikeCounter used={2} />
            <StrikeCounter used={7} />
          </Row>
          <div className="grid gap-8 mt-6">
            <VerdictSign variant="pass" score={26} outOf={30} />
            <VerdictSign variant="short" score={21} outOf={30} />
            <VerdictSign variant="halted" score={12} outOf={30} />
          </div>
        </Section>

        {/* ------------------------------------------------------- app states */}
        <Section id="states" title="EmptyState · ErrorState · LoadingSkeleton">
          <SignPanel flat>
            <EmptyState
              title="Nothing queued yet"
              body="Answer a few questions and this fills in with whatever you keep getting wrong."
              action={
                <Button variant="guide" to="/study">
                  Start studying
                </Button>
              }
            />
          </SignPanel>
          <div className="mt-4">
            <SignPanel flat>
              <ErrorState
                title="Your progress could not be read"
                body="The saved data on this device is unreadable. You can start fresh without losing the question bank."
                detail="SyntaxError: Unexpected token g in JSON at position 0"
                onRetry={() => undefined}
                secondaryAction={<Button variant="danger">Start fresh</Button>}
              />
            </SignPanel>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SignPanel flat>
              <p className="eyebrow">Skeleton</p>
              <LoadingSkeleton lines={4} label="Loading your progress" />
            </SignPanel>
            <div className="panel panel--flat bg-guide">
              <p className="eyebrow text-sign-white">Skeleton on a sign face</p>
              <LoadingSkeleton lines={4} onSign label="Loading your route" />
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------ notifications */}
        <Section id="notify" title="Toast · Dialog · OfflineBadge · CitationLink · VisuallyHidden">
          <Row label="OfflineBadge">
            <OfflineBadge />
            <OfflineBadge online={false} />
          </Row>
          <Row label="CitationLink">
            <CitationLink to="/gallery" section="Sharing the Road" pdfPage={79} />
          </Row>
          <Row label="VisuallyHidden — present below, but only to assistive tech">
            <span className="dim text-sm">
              There is a hidden phrase here.
              <VisuallyHidden>Answered correctly.</VisuallyHidden>
            </span>
          </Row>
          <div className="grid gap-2.5 max-w-[30rem] mb-6">
            <p className="eyebrow">Toast</p>
            <Toast tone="guide" title="Saved offline" onDismiss={() => undefined}>
              Your answer is stored on this device.
            </Toast>
            <Toast tone="warn" title="An update is ready" onDismiss={() => undefined}>
              It will install when you finish this session.
            </Toast>
            <Toast tone="stop" title="Storage is unavailable" onDismiss={() => undefined}>
              This session will not be remembered.
            </Toast>
          </div>
          <Row label="Dialog — native <dialog>, focus trapped, Escape closes">
            <Button
              variant="quiet"
              onClick={() => {
                setDialogOpen(true);
              }}
            >
              Open the confirmation
            </Button>
          </Row>
          <Dialog
            open={dialogOpen}
            tone="stop"
            title="End this exam?"
            onClose={() => {
              setDialogOpen(false);
            }}
            actions={
              <>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setDialogOpen(false);
                  }}
                >
                  Keep going
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setDialogOpen(false);
                  }}
                >
                  End and score it
                </Button>
              </>
            }
          >
            <p className="dim text-sm">
              You are 12 questions in. Ending now scores what you have answered and the rest count
              as wrong.
            </p>
          </Dialog>
        </Section>

        {/* ------------------------------------------------------------- forms */}
        <Section
          id="forms"
          title="DateField · ConfirmGate · Chip · SearchField · SwitchRow · SegmentedField"
          note="No raw browser controls. A native date input and a native checkbox are OS-dependent, cannot be made cohesive, and read as defaults — so both are rebuilt on real semantics."
        >
          <div className="grid gap-8 max-w-[34rem]">
            <DateField
              legend="When is your test?"
              value={date}
              onChange={setDate}
              hint="Used only to pace your study. It never leaves this device."
            />

            <div>
              <p className="eyebrow">SearchField</p>
              <SearchField
                label="Search signs"
                value={query}
                onChange={setQuery}
                placeholder="Shape, colour or meaning"
              />
            </div>

            <div>
              <p className="eyebrow">Chip — pressed state carries a tick, not just a fill</p>
              <div className="chips">
                {Object.entries(chips).map(([name, pressed]) => (
                  <Chip
                    key={name}
                    pressed={pressed}
                    onToggle={(next) => {
                      setChips((prev) => ({ ...prev, [name]: next }));
                    }}
                    dotColor={name === 'Warning' ? '#FFCC00' : '#B4151C'}
                  >
                    {name}
                  </Chip>
                ))}
              </div>
            </div>

            <SegmentedField
              legend="Drill asks for"
              name="gallery-drill"
              value={drill}
              onChange={setDrill}
              options={[
                { value: 'meaning', label: 'Meaning' },
                { value: 'shape', label: 'Shape & color' },
              ]}
            />

            <SignPanel flat>
              <SwitchRow
                name="Reduce motion"
                description="Turn off every transition and shimmer."
                checked={reduceMotion}
                onChange={setReduceMotion}
              />
              <SwitchRow
                name="Show corrections"
                description="Flag rules that changed after the manual's 2022 currency date."
                checked={!reduceMotion}
                onChange={(next) => {
                  setReduceMotion(!next);
                }}
              />
            </SignPanel>

            <SignPanel variant="stop">
              <p className="eyebrow eyebrow--stop">ConfirmGate</p>
              <ConfirmGate checked={gate} onChange={setGate}>
                I understand this erases every answer, every attempt and every streak on this
                device.
              </ConfirmGate>
              <div className="mt-4">
                <Button variant="danger" disabled={!gate} describedBy="gate-hint">
                  Erase everything
                </Button>
                <p id="gate-hint" className="faint text-[0.75rem] mt-2">
                  {gate ? 'This cannot be undone.' : 'Tick the box to enable this.'}
                </p>
              </div>
            </SignPanel>
          </div>
        </Section>

        {/* ------------------------------------------------------- focus chrome */}
        <Section
          id="chrome"
          title="AppBar · FocusChrome"
          note="One app-bar pattern across the whole product: back-link · title · context line —— offline badge. The brand is never in the page header; AppNav renders it at the head of the desktop side rail."
        >
          <div className="border border-shoulder rounded-lg overflow-hidden">
            <AppBar title="Road signs" context="84 signs · MUTCD" backTo="/study" />
          </div>
          <p className="dim text-sm mt-4">
            FocusChrome hides the nav entirely and owns the offset itself — see it live at{' '}
            <code className="num">/gallery/focus</code>.
          </p>
        </Section>

        {dockVisible && (
          <ToastDock>
            <Toast
              tone="guide"
              title="Gallery is a dev surface"
              onDismiss={() => {
                setDockVisible(false);
              }}
            >
              It is deliberately absent from the nav. Dismiss to see the dock disappear.
            </Toast>
          </ToastDock>
        )}
      </main>
    </>
  );
}
