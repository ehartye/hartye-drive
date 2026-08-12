import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import {
  AppBar,
  Button,
  EmptyState,
  SignPanel,
  StatTile,
  VerdictSign,
} from '~/components';
import { usePageTitle } from '~/app/usePageTitle';
import { formatClock } from '~/domain/mastery';
import { describeExamOutcome, examHeadline } from '~/domain/exam';
import type { ExamReport as ExamReportShape } from '~/domain/exam';
import { attemptById, latestAttempt, reportFromAttempt } from '~/domain/exam-history';
import type { ExamAttempt } from '~/domain/exam-history';
import { useExamStore } from '~/store/exam';
import { AreaBreakdown, FixItPanel, ReportFooter, StrikeLine } from './exam/parts';
import { EXAM_AREAS, formatAttemptWhen } from './exam/support';

/**
 * The score report — state-matrix cells 6a (passed), 6b (fell short) and 6c
 * (ended early at seven wrong). One page, three voices, because the three
 * results are three different pieces of news.
 *
 * Everything on it is recomputed from the stored paper and answers, so a report
 * opened months later cannot disagree with the rules that produced it.
 */
export function ExamReport() {
  usePageTitle('Score report');
  const [params] = useSearchParams();
  const record = useExamStore((s) => s.record);

  const wanted = params.get('a');
  const attempt = wanted ? attemptById(record, wanted) : latestAttempt(record);

  if (!attempt) {
    return (
      <>
        <AppBar title="Score report" context="Mock exam" backTo="/exam" backLabel="Back" />
        <main className="wrap pt-6">
          <EmptyState
            headingLevel={1}
            title="No exam sat yet"
            body="Sit a mock exam and the report lands here — the score, the four blueprint areas, and every question with the manual page behind it."
            signId="d1-1-destination"
            action={
              <Button variant="guide" to="/exam">
                Go to the exam
              </Button>
            }
          />
        </main>
      </>
    );
  }

  return <Report attempt={attempt} />;
}

function Report({ attempt }: { attempt: ExamAttempt }) {
  const report = reportFromAttempt(attempt, EXAM_AREAS);
  const when = formatAttemptWhen(attempt.endedAt);
  const headline = examHeadline(report);
  const halted = report.verdict === 'halted';

  /* The result is news, and a screen-reader user should hear it rather than go
     looking for it. A live region only announces content that arrives *after*
     it is registered, so the sentence is written to the node once it is mounted
     — updating an external system (the DOM) with React state, which is what an
     effect is actually for (practices A9). */
  const liveRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const node = liveRef.current;
    if (node) node.textContent = `${headline}. ${String(report.correct)} correct of ${String(report.outOf)}.`;
  }, [headline, report.correct, report.outOf]);

  return (
    <>
      <AppBar
        title="Score report"
        context={`Mock exam · ${when}`}
        backTo="/exam"
        backLabel="Back"
      />

      <main className="wrap stack pt-6">
        <p className="sr-only" role="status" ref={liveRef} />

        <div>
          <p
            className={`eyebrow ${report.verdict === 'pass' ? 'eyebrow--guide' : halted ? 'eyebrow--stop' : ''}`}
          >
            {`Mock exam · ${when}`}
          </p>
          <h1>{headline}</h1>
        </div>

        <div className={halted ? 'halt' : ''}>
          <VerdictSign variant={report.verdict} score={report.correct} outOf={report.outOf} />
        </div>

        {halted && <StrikeLine used={report.wrong} limit={report.wrongLimit} />}

        {/* Left-aligned when it is long: a paragraph that runs to five lines
            reads badly centred, and the halted explanation is the long one. */}
        <p className={`read m-0 ${halted ? '' : 'text-center'}`}>{describeExamOutcome(report)}</p>

        <Tiles report={report} />

        <hr className="centreline" />

        <section>
          <h2 className="mb-3.5">
            {halted
              ? 'What you were asked'
              : report.verdict === 'pass'
                ? `Where the ${String(report.wrong)} went`
                : 'What sank it'}
          </h2>
          <AreaBreakdown
            byArea={report.byArea}
            note={
              halted
                ? `Sampled across the four areas the manual publishes. The other ${String(report.unasked)} questions were never asked — they stay in the bank for your next attempt.`
                : 'The four areas the manual publishes, each a quarter of the test.'
            }
          />
        </section>

        {report.verdict === 'pass' && report.weakestAreas.length > 0 && (
          <SignPanel as="section" variant="warn">
            <p className="eyebrow eyebrow--warning">Still worth a look</p>
            <p className="dim text-sm m-0">
              {`${report.weakestAreas.length === 1 ? 'One area is' : `${String(report.weakestAreas.length)} areas are`} under 80%. A pass is a pass — but that is the ground that would go first on a bad day.`}
            </p>
          </SignPanel>
        )}

        {report.verdict !== 'pass' && (
          <FixItPanel missedIds={report.missedQuestionIds} weakestAreas={report.weakestAreas} />
        )}

        <div>
          <Button variant="guide" block to={`/exam/review?a=${encodeURIComponent(attempt.id)}`}>
            {report.answered === report.outOf
              ? `Review all ${String(report.outOf)} answers`
              : `Review the ${String(report.answered)} you answered`}
          </Button>
          <Button variant="quiet" block to="/exam" className="mt-3">
            {report.verdict === 'pass' ? 'Take another mock exam' : 'Take the exam again'}
          </Button>
        </div>

        <ReportFooter />
      </main>
    </>
  );
}

/** Three tiles. Which three depends on what the news actually is. */
function Tiles({ report }: { report: ExamReportShape }) {
  const time = formatClock(report.elapsedSeconds);
  const tiles =
    report.verdict === 'halted'
      ? [
          { value: report.answered, label: 'Answered' },
          { value: report.correct, label: 'Correct' },
          { value: time, label: 'Time' },
        ]
      : [
          { value: report.wrong, label: 'Wrong' },
          { value: time, label: 'Time' },
          { value: report.passMark, label: 'Needed' },
        ];

  return (
    <div className="grid-tiles">
      {tiles.map((tile) => (
        <SignPanel key={tile.label} flat>
          <StatTile value={tile.value} label={tile.label} />
        </SignPanel>
      ))}
    </div>
  );
}
