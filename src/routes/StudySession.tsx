import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdvanceFocus } from '~/app/useAdvanceFocus';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Button,
  ChoiceRow,
  Dialog,
  ExplanationBlock,
  FocusChrome,
  LoadingSkeleton,
  QuestionCard,
  SignPanel,
  ErrorState,
} from '~/components';
import { IconArrowRight } from '~/components/Icon';
import { correctionById, loadQuestionBank, topicById } from '~/content';
import type { Question, QuestionBank } from '~/content';
import { usePageTitle } from '~/app/usePageTitle';
import { describeReview } from '~/domain/scheduler';
import { DEFAULT_SESSION_SIZE, buildSession, sessionRationale } from '~/domain/session';
import type { SessionPlan } from '~/domain/session';
import { useProgressStore } from '~/store/progress';
import { CorrectionNotice, ManualLookup, QueuedAgain } from './study/parts';
import { signForTopic } from './study/support';

/* ------------------------------------------------------------------- types */

type BankState =
  | { status: 'loading' }
  | { status: 'ready'; bank: QuestionBank; plan: SessionPlan }
  | { status: 'error'; detail: string };

interface Answered {
  chosenIndex: number;
  correct: boolean;
  /** The scheduler's own sentence about what happens to this card next. */
  sentence: string;
}

const labelFor = (topicId: string) => topicById(topicId)?.label ?? topicId;

/* ------------------------------------------------------------------- route */

/**
 * The study session: question asked → answer chosen → verdict, rule and
 * citation revealed → next. Full-screen focus mode with the nav gone
 * (grounding §4), a mile marker and rail for position, and a guarded exit.
 *
 * Every decision it makes — which questions, in what order, when each returns —
 * comes from `src/domain/`. This file renders and nothing more.
 */
export function StudySession() {
  usePageTitle('Study session');
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [state, setState] = useState<BankState>({ status: 'loading' });
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const answer = useProgressStore((s) => s.answer);
  const finishSession = useProgressStore((s) => s.finishSession);
  const storageMode = useProgressStore((s) => s.storageMode);

  const size = Number(params.get('n')) || DEFAULT_SESSION_SIZE;
  const seedParam = params.get('seed');
  const pinned = params.get('q');

  /* Load the bank and lay out the session once. The plan must not be rebuilt
     when the store changes — answering a question would otherwise reshuffle the
     session underneath the learner — so the record is read imperatively here
     rather than subscribed to. */
  useEffect(() => {
    let live = true;

    loadQuestionBank()
      .then((bank) => {
        if (!live) return;
        const { progress } = useProgressStore.getState();
        const plan = pinned
          ? planFromIds(bank, pinned)
          : buildSession({
              candidates: bank.questions.map((q) => ({ id: q.id, topic: q.topic, area: q.area })),
              cards: progress.cards,
              topics: progress.topics,
              now: Date.now(),
              size,
              // A fresh seed per visit, so two sessions in a row are not the
              // same twelve questions; `?seed=` pins it for tests and reviewers.
              seed: Number(seedParam) || Date.now(),
            });

        if (plan.picks.length === 0) {
          setState({ status: 'error', detail: 'The question bank loaded but held no questions.' });
          return;
        }
        setState({ status: 'ready', bank, plan });
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
  }, [size, seedParam, pinned, attempt]);

  const byId = useMemo(
    () => (state.status === 'ready' ? new Map(state.bank.questions.map((q) => [q.id, q])) : null),
    [state],
  );

  const pick = state.status === 'ready' ? state.plan.picks[index] : undefined;
  const question: Question | null = pick && byId ? (byId.get(pick.questionId) ?? null) : null;

  /* A route change inside the session must not leave focus on the button the
     learner just pressed, three screens down the page — and the next question
     must start at the top, not wherever reading the explanation left them. */
  const stageRef = useAdvanceFocus<HTMLDivElement>(index);

  const onChoose = useCallback(
    (chosenIndex: number) => {
      if (!question || answered) return;
      const correct = chosenIndex === question.correctIndex;
      const { before, after } = answer({
        questionId: question.id,
        topic: question.topic,
        area: question.area,
        chosenIndex,
        correct,
        at: Date.now(),
      });
      setAnswered({ chosenIndex, correct, sentence: describeReview(before, after, correct) });
      if (correct) setCorrectCount((n) => n + 1);
    },
    [question, answered, answer],
  );

  /* A / B / C and 1 / 2 / 3 answer the question, so a keyboard learner never
     has to tab past the ones they have ruled out (practices A4). */
  useEffect(() => {
    if (!question || answered) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      const letters = question.options.map((o) => o.letter.toLowerCase());
      const byLetter = letters.indexOf(key);
      const byNumber = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      const picked = byLetter >= 0 ? byLetter : byNumber;
      if (picked < 0 || picked >= question.options.length) return;
      event.preventDefault();
      onChoose(picked);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [question, answered, onChoose]);

  /* ------------------------------------------------------------- rendering */

  const exit = () => {
    void navigate('/study');
  };

  if (state.status === 'loading') {
    return (
      <FocusChrome exitLabel="End session" onExit={exit}>
        <p className="eyebrow">Adaptive session</p>
        <div className="mt-5">
          <LoadingSkeleton lines={3} label="Building your session" />
        </div>
        <div className="grid gap-2.5 mt-6" aria-hidden="true">
          {['a', 'b', 'c'].map((slot) => (
            <span key={slot} className="skel block h-[72px]" />
          ))}
        </div>
      </FocusChrome>
    );
  }

  if (state.status === 'error') {
    return (
      <FocusChrome exitLabel="Leave" onExit={exit}>
        <ErrorState
          headingLevel={1}
          title="This session could not be built"
          body="The question bank did not load. Nothing has been lost — your progress is saved on this device."
          detail={state.detail}
          onRetry={() => {
            setState({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
          retryLabel="Try again"
          secondaryAction={
            <Button variant="quiet" to="/study">
              Back to Study
            </Button>
          }
        />
      </FocusChrome>
    );
  }

  const { plan } = state;
  const total = plan.picks.length;
  const answeredCount = index + (answered ? 1 : 0);

  if (finished) {
    return (
      <SessionComplete
        total={total}
        correct={correctCount}
        weakestTopics={plan.weakestTopics}
        onExit={exit}
      />
    );
  }

  if (!question) {
    return (
      <FocusChrome exitLabel="Leave" onExit={exit}>
        <ErrorState
          headingLevel={1}
          title="That question is missing"
          body="The session referred to a question that is not in this build of the bank."
          secondaryAction={
            <Button variant="quiet" to="/study">
              Back to Study
            </Button>
          }
        />
      </FocusChrome>
    );
  }

  const topic = topicById(question.topic);
  const citation = question.citations[0];
  const correction = question.correctionId ? correctionById(question.correctionId) : undefined;
  const correctLetter = question.options[question.correctIndex]?.letter ?? '—';
  const remaining = total - index - 1;

  const announcement = answered
    ? answered.correct
      ? `Correct. ${correctLetter} is the right answer.`
      : `Incorrect. You chose ${question.options[answered.chosenIndex]?.letter ?? '—'}. The right answer is ${correctLetter}.`
    : undefined;

  const goNext = () => {
    if (index + 1 >= total) {
      finishSession(Date.now());
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setAnswered(null);
  };

  return (
    <>
      <FocusChrome
        exitLabel="End session"
        onExit={() => {
          setConfirmingExit(true);
        }}
        marker={{ index: index + 1, total }}
        progress={{
          value: answeredCount,
          max: total,
          label: `Session progress: ${String(answeredCount)} of ${String(total)} questions answered`,
        }}
        action={
          answered ? (
            <>
              <Button variant="guide" block onClick={goNext}>
                {index + 1 >= total ? 'Finish session' : 'Next question'}
                <IconArrowRight size={18} />
              </Button>
              <p className="faint text-[0.75rem] text-center mt-2.5">
                {remaining === 0
                  ? 'Last question in this session'
                  : `${String(remaining)} question${remaining === 1 ? '' : 's'} left in this session`}
              </p>
            </>
          ) : undefined
        }
      >
        {/* tabIndex -1: focus lands here when the next question arrives, so the
            learner is never left focused on a button below content that changed. */}
        <div ref={stageRef} tabIndex={-1}>
          <QuestionCard
            eyebrow="Adaptive session"
            topic={topic ? `${areaLabel(question.area)} · ${topic.label}` : question.topic}
            signId={signForTopic(question.topic, question.area)}
            stem={question.stem}
            {...(announcement ? { announcement } : {})}
          >
            {question.options.map((option, optionIndex) => (
              <ChoiceRow
                key={option.letter}
                letter={option.letter}
                state={choiceState(optionIndex, question.correctIndex, answered)}
                picked={answered?.chosenIndex === optionIndex}
                disabled={answered !== null}
                onSelect={() => {
                  onChoose(optionIndex);
                }}
              >
                {option.text}
              </ChoiceRow>
            ))}
          </QuestionCard>

          {correction && (
            <div className="mt-4.5">
              <CorrectionNotice correction={correction} />
            </div>
          )}

          {!answered && citation && (
            <div className="mt-4.5">
              <ManualLookup
                citation={citation}
                section={topic?.label ?? question.topic}
                supersededNote={
                  correction
                    ? 'Content current as of July 1, 2022 · superseded — see the correction above'
                    : undefined
                }
              />
            </div>
          )}

          {answered && citation && (
            <div className="mt-5">
              <ExplanationBlock
                citation={{
                  section: topic?.label ?? question.topic,
                  pdfPage: citation.pdfPage,
                  printedPage: citation.printedPage,
                  quote: citation.quote,
                  // P8: the citation now resolves. `ExplanationBlock` turns the
                  // rule id into `/rules/:id` itself, so this is the whole wiring.
                  ruleId: citation.ruleId,
                }}
                verdict={answered.correct ? 'correct' : 'incorrect'}
                answerLetter={correctLetter}
              >
                <p>{question.explanation}</p>
              </ExplanationBlock>
            </div>
          )}

          {answered &&
            (answered.correct ? (
              <p className="dim text-[0.8125rem] text-center mt-4">{answered.sentence}</p>
            ) : (
              <QueuedAgain sentence={answered.sentence} />
            ))}

          {!answered && (
            <>
              <p className="dim text-[0.8125rem] text-center mt-6">
                Pick the answer you think is right. You&rsquo;ll see the rule and the manual page
                straight after.
              </p>
              <p className="faint text-[0.75rem] text-center mt-5 mb-12 leading-normal">
                {`Question ${String(index + 1)} of ${String(total)} · ${sessionRationale(plan.weakestTopics, labelFor)}`}
                <br />
                Not affiliated with the State of Tennessee.
              </p>
            </>
          )}

          {storageMode === 'session-only' && (
            <p className="faint text-[0.75rem] text-center mt-5">
              This device is not letting the app save progress, so this session will not be
              remembered.
            </p>
          )}
        </div>
      </FocusChrome>

      <Dialog
        open={confirmingExit}
        title="End this session?"
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
              Keep studying
            </Button>
            <Button variant="danger" onClick={exit}>
              End session
            </Button>
          </>
        }
      >
        <p className="dim text-[0.9375rem]">
          {`You have answered ${String(answeredCount)} of ${String(total)}. Every answer so far is already saved, and anything you missed is already queued to come back — you just lose the rest of this session's line-up.`}
        </p>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------- sub-screens */

interface SessionCompleteProps {
  total: number;
  correct: number;
  weakestTopics: string[];
  onExit: () => void;
}

function SessionComplete({ total, correct, weakestTopics, onExit }: SessionCompleteProps) {
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return (
    <FocusChrome
      exitLabel="Back to Study"
      onExit={onExit}
      progress={{ value: total, max: total, label: 'Session complete' }}
      action={
        <Button variant="guide" block to="/study">
          Back to Study
        </Button>
      }
    >
      <p className="eyebrow eyebrow--guide">Session complete</p>
      <h1 className="mt-2">{`${String(correct)} of ${String(total)} right`}</h1>
      <p className="dim mt-2 text-[0.9375rem]">
        {percent >= 80
          ? 'That is knowledge-test pace. Keep the streak going and the intervals stretch out on their own.'
          : 'Everything you missed is already queued to come back — first in about ten minutes, then tomorrow.'}
      </p>
      {weakestTopics.length > 0 && (
        <SignPanel as="section" variant="warn" flat className="mt-5">
          <p className="eyebrow eyebrow--warning">Still your weakest ground</p>
          <p className="dim text-[0.9375rem]">
            {weakestTopics.slice(0, 3).map(labelFor).join(' · ')}
          </p>
        </SignPanel>
      )}
      <p className="faint text-[0.75rem] text-center mt-8 mb-12">
        Not affiliated with the State of Tennessee.
      </p>
    </FocusChrome>
  );
}

/* ------------------------------------------------------------------ helpers */

const AREA_LABEL: Record<string, string> = {
  signs: 'Traffic signs and signals',
  'safe-driving': 'Safe driving',
  'rules-of-road': 'Rules of the road',
  'alcohol-drugs': 'Alcohol and drugs',
};

const areaLabel = (area: string) => AREA_LABEL[area] ?? area;

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

/**
 * `?q=id,id` pins an exact line-up. It exists so a citation can one day say
 * "practise this rule", and so a test or a reviewer can drive the session to a
 * specific question — the long-content cell, for instance — without fighting
 * the adaptive engine.
 */
function planFromIds(bank: QuestionBank, csv: string): SessionPlan {
  const wanted = csv.split(',').map((s) => s.trim()).filter(Boolean);
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  return {
    picks: wanted.flatMap((id) => {
      const question = byId.get(id);
      return question ? [{ questionId: id, topic: question.topic, reason: 'due' as const }] : [];
    }),
    weakestTopics: [],
  };
}
