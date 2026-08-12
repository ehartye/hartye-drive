import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  AppBar,
  Button,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SegmentedField,
  VerdictSign,
} from '~/components';
import { correctionById, loadQuestionBank } from '~/content';
import type { Question, QuestionBank } from '~/content';
import { usePageTitle } from '~/app/usePageTitle';
import { examAnswerFor } from '~/domain/exam';
import { attemptById, latestAttempt, reportFromAttempt, stateFromAttempt } from '~/domain/exam-history';
import type { ExamAttempt } from '~/domain/exam-history';
import { useExamStore } from '~/store/exam';
import { AreaBreakdown, ReportFooter, ReviewItem } from './exam/parts';
import { EXAM_AREAS, formatAttemptWhen } from './exam/support';

type BankState =
  | { status: 'loading' }
  | { status: 'ready'; bank: QuestionBank }
  | { status: 'error'; detail: string };

type Filter = 'all' | 'missed';

/**
 * The full review — state-matrix cell 6-long-content, mockup `06d`.
 *
 * Every question that was asked, **in the order it was asked**, with what was
 * picked, what was right, why, and the manual page it came from. It is not
 * grouped by topic on purpose: the exam interleaves the four blueprint areas,
 * so the run below is the run the learner actually sat, and each block names
 * its own area because its position no longer does.
 */
export function ExamReview() {
  usePageTitle('Full review');
  const [params] = useSearchParams();
  const record = useExamStore((s) => s.record);
  const [state, setState] = useState<BankState>({ status: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    loadQuestionBank()
      .then((bank) => {
        if (live) setState({ status: 'ready', bank });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({
          status: 'error',
          detail: error instanceof Error ? error.message : 'The question bank could not be read.',
        });
      });
    return () => {
      live = false;
    };
  }, [reload]);

  const wanted = params.get('a');
  const attempt = wanted ? attemptById(record, wanted) : latestAttempt(record);

  if (!attempt) {
    return (
      <>
        <AppBar title="Full review" context="Mock exam" backTo="/exam" backLabel="Back" />
        <main className="wrap pt-6">
          <EmptyState
            headingLevel={1}
            title="Nothing to review yet"
            body="Sit a mock exam and every question you were asked lands here, in order, with the manual page behind each one."
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

  if (state.status === 'error') {
    return (
      <>
        <AppBar title="Full review" context="Mock exam" backTo="/exam" backLabel="Back" />
        <main className="wrap pt-6">
          <ErrorState
            headingLevel={1}
            title="The review could not be built"
            body="The question bank did not load. Your attempt is safe — the score report still has the result."
            detail={state.detail}
            onRetry={() => {
              setState({ status: 'loading' });
              setReload((n) => n + 1);
            }}
            secondaryAction={
              <Button variant="quiet" to={`/exam/report?a=${encodeURIComponent(attempt.id)}`}>
                Back to the score
              </Button>
            }
          />
        </main>
      </>
    );
  }

  return <Review attempt={attempt} bank={state.status === 'ready' ? state.bank : null} />;
}

function Review({ attempt, bank }: { attempt: ExamAttempt; bank: QuestionBank | null }) {
  const [filter, setFilter] = useState<Filter>('all');

  const report = reportFromAttempt(attempt, EXAM_AREAS);
  const state = stateFromAttempt(attempt);
  const when = formatAttemptWhen(attempt.endedAt);

  const byId = useMemo(
    () => (bank ? new Map(bank.questions.map((q) => [q.id, q])) : new Map<string, Question>()),
    [bank],
  );

  /* The paper as it was sat: only what was asked. A halted attempt has no
     "questions 20 to 30" to review — they were never put to the learner. */
  const asked = state.questions.slice(0, attempt.answers.length);
  const shown = filter === 'missed' ? asked.filter((_, i) => !isCorrect(attempt, i)) : asked;
  const firstMiss = asked.findIndex((_, i) => !isCorrect(attempt, i));

  return (
    <>
      <AppBar
        title="Full review"
        context={`${String(asked.length)} asked · ${String(report.wrong)} missed · ${when}`}
        backTo={`/exam/report?a=${encodeURIComponent(attempt.id)}`}
        backLabel="Back"
      />

      <main className="wrap pt-6">
        <div className="mb-5">
          <p className="eyebrow">{`Mock exam · ${when} · full review`}</p>
          <h1>
            {asked.length === report.outOf
              ? `All ${String(report.outOf)}, in order`
              : `The ${String(asked.length)} you were asked, in order`}
          </h1>
        </div>

        <VerdictSign variant={report.verdict} score={report.correct} outOf={report.outOf} />

        <p className="read mt-5 text-center">
          {`Tennessee needs ${String(report.passMark)} of ${String(report.outOf)}. Every question you were asked is below, in the order you saw it, with the manual page it came from — the ${String(report.wrong)} you missed are the ones with a red edge.`}
        </p>

        <section className="mt-6">
          <h2 className="mb-3.5">{`Where the ${String(report.wrong)} went`}</h2>
          <AreaBreakdown
            byArea={report.byArea}
            note="The four areas the manual publishes, each a quarter of the test. The exam interleaves them, so the questions below are not grouped — they are in the order you sat them."
          />
        </section>

        <div className="reviewbar mt-6">
          <SegmentedField
            legend="Show"
            name="review-filter"
            value={filter}
            options={[
              { value: 'all', label: `All ${String(asked.length)}` },
              { value: 'missed', label: `Missed ${String(report.wrong)}` },
            ]}
            onChange={(next) => {
              setFilter(next === 'missed' ? 'missed' : 'all');
            }}
          />
          {report.wrong > 0 && firstMiss >= 0 && (
            <a className="jump" href={`#q${String(firstMiss + 1).padStart(2, '0')}`}>
              Jump to first miss
            </a>
          )}
        </div>

        <hr className="centreline mt-5" />

        {!bank && (
          <div className="mt-5">
            <LoadingSkeleton lines={4} label="Loading the questions you were asked" />
          </div>
        )}

        <section aria-label={`The ${String(shown.length)} questions shown, in the order they were asked`}>
          {shown.map((item) => {
            const position = asked.indexOf(item) + 1;
            const question = byId.get(item.questionId);
            const correction = question?.correctionId
              ? correctionById(question.correctionId)
              : undefined;
            return (
              <ReviewItem
                key={item.questionId}
                position={position}
                item={item}
                question={question}
                answer={examAnswerFor(state, item.questionId)}
                {...(correction ? { correctionSummary: correction.summary } : {})}
              />
            );
          })}
        </section>

        {shown.length === 0 && (
          <EmptyState
            title="Nothing missed"
            body="Every question you were asked, you answered correctly. Switch back to all to read them again."
            action={
              <Button
                variant="quiet"
                onClick={() => {
                  setFilter('all');
                }}
              >
                Show every question
              </Button>
            }
          />
        )}

        {report.unasked > 0 && filter === 'all' && (
          <p className="dim text-[0.8125rem] text-center mt-5">
            {`${String(report.unasked)} of the ${String(report.outOf)} were never asked — the exam ended first. They stay in the bank for your next attempt.`}
          </p>
        )}

        <hr className="centreline" />

        <div>
          <Button variant="quiet" block to={`/exam/report?a=${encodeURIComponent(attempt.id)}`}>
            Back to the score summary
          </Button>
        </div>

        <ReportFooter withSource />
      </main>
    </>
  );
}

function isCorrect(attempt: ExamAttempt, index: number): boolean {
  return attempt.answers[index]?.correct ?? false;
}
