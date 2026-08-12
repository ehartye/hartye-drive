import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useSearchParams } from 'react-router';
import {
  Button,
  ChoiceRow,
  Dialog,
  ErrorState,
  FocusChrome,
  LoadingSkeleton,
  MileMarker,
  QuestionCard,
  SignPanel,
  StrikeCounter,
  Timer,
} from '~/components';
import { IconArrowRight } from '~/components/Icon';
import { loadQuestionBank } from '~/content';
import type { Question, QuestionBank } from '~/content';
import { usePageTitle } from '~/app/usePageTitle';
import {
  EXAM_PASS_MARK,
  EXAM_QUESTION_COUNT,
  EXAM_WRONG_LIMIT,
  REACHABLE_AFTER_WRONG_LIMIT,
  answerExamQuestion,
  currentQuestion,
  endExamEarly,
  examCorrect,
  examStrikes,
  expireExam,
  isExamRunning,
  secondsRemaining,
  startExam,
} from '~/domain/exam';
import type { ExamState } from '~/domain/exam';
import { openAttempt } from '~/domain/exam-history';
import { useExamStore } from '~/store/exam';
import { useProgressStore } from '~/store/progress';
import { EXAM_AREAS, newAttemptId } from './exam/support';

type BankState =
  | { status: 'loading' }
  | { status: 'ready'; bank: QuestionBank }
  | { status: 'error'; detail: string };

/**
 * The exam simulator — the faithful one.
 *
 * Thirty questions, sixty minutes on the wall clock, twenty-four to pass, and
 * **seven wrong ends it**, because 30 − 7 = 23 and 23 is under 24. No going
 * back, no verdict until the report, and an exit that always asks first.
 *
 * Every rule it enforces lives in `src/domain/exam.ts`; this file renders and
 * nothing more. The attempt in progress is persisted on every answer, so a
 * reload, a phone call or a crash never silently destroys it — and the clock
 * keeps running while you are away, exactly as it would at a Driver Services
 * Center.
 */
export function ExamRun() {
  usePageTitle('Exam in progress');
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [state, setState] = useState<BankState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [exam, setExam] = useState<ExamState | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);

  const saveActive = useExamStore((s) => s.saveActive);
  const fileAttempt = useExamStore((s) => s.fileAttempt);
  const storageMode = useExamStore((s) => s.storageMode);
  const recordAnswer = useProgressStore((s) => s.answer);

  /* Reading the exam record imperatively rather than subscribing to it: the
     attempt on screen is this component's, and re-reading it on every store
     write would fight the learner mid-question. */
  useEffect(() => {
    let live = true;
    loadQuestionBank()
      .then((bank) => {
        if (!live) return;
        setState({ status: 'ready', bank });
        const at = Date.now();
        const active = openAttempt(useExamStore.getState().record);
        if (!active) return;
        if (isExamRunning(active, at)) {
          setExam(active);
          return;
        }
        // The hour ran out while the app was closed. The attempt happened, so
        // it is scored and filed rather than quietly dropped.
        fileAttempt(expireExam(active, at), EXAM_AREAS);
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
  }, [reload, fileAttempt]);

  const byId = useMemo(
    () => (state.status === 'ready' ? new Map(state.bank.questions.map((q) => [q.id, q])) : null),
    [state],
  );

  const askedRef = exam ? currentQuestion(exam) : undefined;
  const question: Question | undefined =
    askedRef && byId ? byId.get(askedRef.questionId) : undefined;

  /* The blocker and the finish path both read live values through refs: a
     stale closure here would either block the app's own navigation to the
     score report or fail to guard a real one. */
  const examRef = useRef<ExamState | null>(null);
  const finishedRef = useRef(false);
  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  const finish = useCallback(
    (ended: ExamState) => {
      finishedRef.current = true;
      fileAttempt(ended, EXAM_AREAS);
      setExam(ended);
      void navigate(`/exam/report?a=${encodeURIComponent(ended.id)}`, { replace: true });
    },
    [fileAttempt, navigate],
  );

  /* Browser back, a nav link, anything: leaving mid-exam asks first and is
     never silently destructive (grounding §4). */
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (finishedRef.current) return false;
    const live = examRef.current;
    return (
      live !== null &&
      live.endReason === null &&
      currentLocation.pathname !== nextLocation.pathname
    );
  });

  /* One tick a second, but the clock is the wall clock: the deadline is
     absolute, so a backgrounded tab buys no time and a slow tick loses none. */
  useEffect(() => {
    if (!exam || exam.endReason !== null) return;
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= exam.deadlineAt) finish(expireExam(exam, at));
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [exam, finish]);

  const submit = useCallback(() => {
    if (!exam || !askedRef || !question || picked === null) return;
    const at = Date.now();
    const correct = picked === question.correctIndex;
    const next = answerExamQuestion(exam, { chosenIndex: picked, correct, at });

    // The exam teaches too: a miss here is queued to come back in study. Only
    // once the engine has actually taken the answer, though — an answer
    // submitted after the hour is up counts for nothing, here or there.
    if (next.answers.length > exam.answers.length) {
      recordAnswer({
        questionId: question.id,
        topic: question.topic,
        area: question.area,
        chosenIndex: picked,
        correct,
        at,
      });
    }
    setPicked(null);
    if (next.endReason !== null) {
      finish(next);
      return;
    }
    saveActive(next);
    setExam(next);
  }, [exam, askedRef, question, picked, recordAnswer, saveActive, finish]);

  const startNow = useCallback(() => {
    if (state.status !== 'ready') return;
    const started = startExam({
      id: newAttemptId(),
      candidates: state.bank.questions.map((q) => ({ id: q.id, topic: q.topic, area: q.area })),
      areas: EXAM_AREAS,
      // `?seed=` pins the paper so a reviewer or a test can sit the same exam
      // twice; without it every attempt is a fresh draw.
      seed: Number(params.get('seed')) || Date.now(),
      now: Date.now(),
    });
    setExam(started);
    setPicked(null);
    setNow(Date.now());
    saveActive(started);
  }, [state, params, saveActive]);

  /* A / B / C and 1 / 2 / 3 select an answer, so a keyboard learner never has
     to tab past the ones they have ruled out (practices A4). */
  useEffect(() => {
    if (!question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      const letters = question.options.map((o) => o.letter.toLowerCase());
      const byLetter = letters.indexOf(key);
      const byNumber = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
      const choice = byLetter >= 0 ? byLetter : byNumber;
      if (choice < 0 || choice >= question.options.length) return;
      event.preventDefault();
      setPicked(choice);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [question]);

  /* --------------------------------------------------------------- leaving */

  const leave = () => {
    void navigate('/exam');
  };

  const guardOpen = confirming || blocker.state === 'blocked';

  const keepGoing = () => {
    setConfirming(false);
    blocker.reset?.();
  };

  const endNow = () => {
    setConfirming(false);
    blocker.reset?.();
    if (exam) finish(endExamEarly(exam, Date.now()));
  };

  /* ------------------------------------------------------------- rendering */

  if (state.status === 'loading') {
    return (
      <FocusChrome exitLabel="Leave" onExit={leave}>
        <p className="eyebrow">Class D knowledge test · simulator</p>
        <div className="mt-5">
          <LoadingSkeleton lines={3} label="Drawing your exam" />
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
      <FocusChrome exitLabel="Leave" onExit={leave}>
        <ErrorState
          headingLevel={1}
          title="This exam could not be drawn"
          body="The question bank did not load. Nothing has been lost — no attempt was started."
          detail={state.detail}
          onRetry={() => {
            setState({ status: 'loading' });
            setReload((n) => n + 1);
          }}
          retryLabel="Try again"
          secondaryAction={
            <Button variant="quiet" to="/exam">
              Back to Exam
            </Button>
          }
        />
      </FocusChrome>
    );
  }

  if (!exam) return <Briefing onStart={startNow} onLeave={leave} />;

  if (exam.endReason !== null) {
    return (
      <FocusChrome exitLabel="Leave" onExit={leave}>
        <h1 className="stem">Scoring your exam…</h1>
        <p className="dim mt-3 text-[0.9375rem]">Your score report is on its way.</p>
      </FocusChrome>
    );
  }

  if (!askedRef || !question) {
    return (
      <FocusChrome exitLabel="End exam" onExit={() => { setConfirming(true); }}>
        <ErrorState
          headingLevel={1}
          title="That question is missing"
          body="The exam drew a question that is not in this build of the bank. Ending the attempt scores what you have answered."
          onRetry={endNow}
          retryLabel="End the exam and score it"
        />
      </FocusChrome>
    );
  }

  const position = exam.answers.length;
  const strikes = examStrikes(exam);
  const left = secondsRemaining(exam, now);
  const pickedLetter = picked === null ? '' : (question.options[picked]?.letter ?? '');

  return (
    <>
      <FocusChrome
        exitLabel="End exam"
        onExit={() => {
          setConfirming(true);
        }}
        instruments={<Timer secondsRemaining={left} />}
        statusRow={
          <>
            <MileMarker index={position + 1} total={exam.questions.length} />
            <StrikeCounter used={strikes} limit={EXAM_WRONG_LIMIT} />
          </>
        }
        progress={{
          value: position,
          max: exam.questions.length,
          label: `Exam progress: ${String(position)} of ${String(exam.questions.length)} questions answered`,
        }}
        action={
          <>
            <Button
              variant="guide"
              block
              disabled={picked === null}
              describedBy="exam-final"
              onClick={submit}
            >
              {position + 1 >= exam.questions.length ? 'Finish the exam' : 'Next question'}
              <IconArrowRight size={18} />
            </Button>
            <p id="exam-final" className="faint text-[0.75rem] text-center mt-2.5 leading-normal">
              {`Answers are final. ${String(EXAM_WRONG_LIMIT)} wrong ends the exam, same as the real one.`}
            </p>
          </>
        }
      >
        <div data-qid={question.id}>
          {/* No topic line: the real test does not tell you which chapter a
              question came from, and naming the area would narrow it. */}
          <QuestionCard eyebrow="Class D knowledge test · simulator" stem={question.stem}>
            {question.options.map((option, index) => (
              <ChoiceRow
                key={option.letter}
                letter={option.letter}
                state="neutral"
                picked={picked === index}
                onSelect={() => {
                  setPicked(index);
                }}
              >
                {option.text}
              </ChoiceRow>
            ))}
          </QuestionCard>

          {/* The one live region the exam has: what you picked. There is no
              verdict to announce — nothing is marked until it ends (A9). */}
          <p className="dim text-[0.8125rem] text-center mt-4" role="status">
            {picked === null
              ? ''
              : `${pickedLetter} selected. Nothing is marked until the exam ends.`}
          </p>
          {picked === null && (
            <p className="dim text-[0.8125rem] text-center mt-4">
              Pick one answer. Nothing is marked until the exam ends.
            </p>
          )}

          <p className="faint text-[0.75rem] text-center mt-6 mb-10 leading-normal">
            Not affiliated with the State of Tennessee.
          </p>

          {storageMode === 'session-only' && (
            <p className="faint text-[0.75rem] text-center mb-8">
              This device is not letting the app save anything, so this attempt will not be kept
              after you leave.
            </p>
          )}
        </div>
      </FocusChrome>

      <Dialog
        open={guardOpen}
        title="End the exam now?"
        tone="stop"
        onClose={keepGoing}
        actions={
          <>
            <Button variant="guide" onClick={keepGoing}>
              Keep going
            </Button>
            <Button variant="danger" onClick={endNow}>
              End exam and score it
            </Button>
          </>
        }
      >
        <p className="dim text-[0.9375rem]">
          {`You are ${String(position)} question${position === 1 ? '' : 's'} in. Ending now scores what you have answered — ${String(examCorrect(exam))} correct out of ${String(exam.questions.length)} — and the attempt is closed.`}
        </p>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------- the briefing */

/**
 * The disclosure, immediately before the clock starts (practices A15, WCAG 2.2
 * SC 2.2.1). The 60-minute limit is essential to the simulation — a knowledge
 * test you can take at leisure teaches the wrong thing about the real one — so
 * it is stated in full, in advance, and the timer does not start until this
 * button is pressed.
 */
function Briefing({ onStart, onLeave }: { onStart: () => void; onLeave: () => void }) {
  const rules: { term: string; detail: string }[] = [
    {
      term: `${String(EXAM_QUESTION_COUNT)} questions`,
      detail:
        'A quarter each from traffic signs and signals, safe driving principles, rules of the road, and drugs and alcohol — the blueprint the manual publishes (PDF p. 35, printed p. 21).',
    },
    {
      term: `${String(EXAM_PASS_MARK)} correct to pass`,
      detail: 'The same mark the Driver Service Center uses.',
    },
    {
      term: '60 minutes',
      detail:
        'The clock starts when you press the button below and runs on real time. It keeps running if you leave this screen or close the app.',
    },
    {
      term: `${String(EXAM_WRONG_LIMIT)} wrong ends it`,
      detail: `Once ${String(EXAM_WRONG_LIMIT)} answers are wrong the exam stops, because ${String(EXAM_QUESTION_COUNT)} minus ${String(EXAM_WRONG_LIMIT)} leaves ${String(REACHABLE_AFTER_WRONG_LIMIT)} — under the ${String(EXAM_PASS_MARK)} you need. The real test stops there for the same reason.`,
    },
    {
      term: 'No going back',
      detail:
        'Answers are final, and nothing is marked right or wrong until the exam is over. You get the rule, the manual page and every answer in the report at the end.',
    },
  ];

  return (
    <FocusChrome
      exitLabel="Leave"
      onExit={onLeave}
      action={
        <>
          <Button variant="guide" block onClick={onStart} describedBy="exam-clock">
            Start the exam
            <IconArrowRight size={18} />
          </Button>
          <p id="exam-clock" className="faint text-[0.75rem] text-center mt-2.5 leading-normal">
            The 60-minute clock starts the moment you press this.
          </p>
        </>
      }
    >
      <p className="eyebrow">Class D knowledge test · simulator</p>
      <h1 className="mt-2">Before the clock starts</h1>
      <p className="dim mt-2 text-[0.9375rem]">
        This is the real thing, timed and scored the way Tennessee scores it. Here is exactly what
        you are agreeing to.
      </p>

      <SignPanel as="section" flat className="mt-5">
        <dl className="grid gap-3.5 m-0">
          {rules.map((rule) => (
            <div key={rule.term}>
              <dt className="text-[0.9375rem] font-semibold">{rule.term}</dt>
              <dd className="dim text-sm m-0 mt-1 leading-normal">{rule.detail}</dd>
            </div>
          ))}
        </dl>
      </SignPanel>

      <p className="faint text-[0.75rem] text-center mt-5 mb-10 leading-normal">
        A practice result. It is not a state score and carries no official weight.
        <br />
        Not affiliated with the State of Tennessee.
      </p>
    </FocusChrome>
  );
}
