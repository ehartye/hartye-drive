import { Link } from 'react-router';
import { Button, SignPanel, StrikeCounter, TopicMeter } from '~/components';
import { IconArrowRight, IconBook, IconCheck, IconX } from '~/components/Icon';
import type { Question } from '~/content';
import type { ExamAnswer, ExamAreaScore, ExamQuestionRef } from '~/domain/exam';
import { areaLabel, citationLine, joinAreaLabels, optionLetter, optionText } from './support';

/* ---------------------------------------------------------- area breakdown */

export interface AreaBreakdownProps {
  byArea: readonly ExamAreaScore[];
  /** The line under the meters explaining what the four areas are. */
  note: string;
}

/**
 * The score against the four areas the manual publishes, each a quarter of the
 * test. `TopicMeter` carries the ratified bands — ≥80% guide, 50–79% warn,
 * <50% stop — and states the numbers in text, so the rail is never the only
 * carrier of the reading (§3, §5).
 *
 * An area the attempt never reached is named rather than metered: a 0 / 0 rail
 * would read as "weak" when the truth is "not asked".
 */
export function AreaBreakdown({ byArea, note }: AreaBreakdownProps) {
  const asked = byArea.filter((score) => score.asked > 0);
  const unreached = byArea.filter((score) => score.asked === 0);

  return (
    <SignPanel as="div" flat>
      {asked.map((score) => (
        <TopicMeter
          key={score.area}
          name={areaLabel(score.area)}
          correct={score.correct}
          total={score.asked}
        />
      ))}
      {unreached.length > 0 && (
        <p className="dim text-[0.8125rem] mt-3.5 leading-normal">
          {`The exam ended before it reached ${joinAreaLabels(unreached.map((s) => s.area))}.`}
        </p>
      )}
      <p className="faint text-[0.75rem] mt-3.5 leading-normal">{note}</p>
    </SignPanel>
  );
}

/* ------------------------------------------------------------- strike line */

/** All seven marks spent — the same instrument the exam chrome carried. */
export function StrikeLine({ used, limit = 7 }: { used: number; limit?: number }) {
  return (
    <p className="strikeline">
      <StrikeCounter used={used} limit={limit} />
      <span className="num dim text-[0.6875rem] tracking-[0.1em] uppercase">limit reached</span>
    </p>
  );
}

/* ------------------------------------------------------------ do this next */

export interface FixItPanelProps {
  missedIds: readonly string[];
  weakestAreas: readonly string[];
}

/**
 * The one action worth taking after a miss: the questions themselves, back one
 * at a time, each with the rule and the manual page behind it. It hands the
 * exact ids to the study session's `?q=` line-up, so nothing is re-sampled and
 * nothing is guessed at.
 */
export function FixItPanel({ missedIds, weakestAreas }: FixItPanelProps) {
  if (missedIds.length === 0) return null;
  const areas = joinAreaLabels(weakestAreas.slice(0, 2));

  return (
    <SignPanel as="section" variant="guide">
      <p className="eyebrow eyebrow--guide">Do this next</p>
      <h2 className="text-[1.0625rem] mb-1.5">
        {`Redo the ${String(missedIds.length)} you missed, one at a time`}
      </h2>
      <p className="dim text-sm mb-4">
        {areas
          ? `Your misses clustered in ${areas}. Each one comes back with the rule and the manual page behind it, then again tomorrow, then next week.`
          : 'Each one comes back with the rule and the manual page behind it, then again tomorrow, then next week.'}
      </p>
      <Button variant="guide" block to={`/study/session?q=${missedIds.join(',')}`}>
        Start the fix-it session
        <IconArrowRight size={18} />
      </Button>
    </SignPanel>
  );
}

/* -------------------------------------------------------------- the footer */

/** Consumer honesty, on every report (practices D7). */
export function ReportFooter({ withSource = false }: { withSource?: boolean }) {
  return (
    <p className="faint text-[0.75rem] text-center mt-5 mb-4 leading-normal">
      A practice result. It is not a state score and carries no official weight.
      <br />
      {withSource && (
        <>
          Questions cite the Tennessee Comprehensive Driver License Manual, content current as of 1
          July 2022, with corrections applied and marked.
          <br />
        </>
      )}
      Not affiliated with the State of Tennessee.
    </p>
  );
}

/* -------------------------------------------------------- one reviewed item */

export interface ReviewItemProps {
  position: number;
  item: ExamQuestionRef;
  question: Question | undefined;
  answer: ExamAnswer | undefined;
  /** Set when the manual's text on this question has been superseded (D6/D10). */
  correctionSummary?: string;
}

/**
 * One question, as it was sat: what was picked, what was right, why, and the
 * page it came from. A correct item collapses its two answer rows into one, so
 * a miss is visibly the longer block — and the misses are the only ones with a
 * red edge and a tinted ground, findable from a thumb-scroll away.
 */
export function ReviewItem({
  position,
  item,
  question,
  answer,
  correctionSummary,
}: ReviewItemProps) {
  const missed = answer ? !answer.correct : false;
  const correctIndex = question?.correctIndex ?? -1;
  const citation = question?.citations[0];

  return (
    <article
      className={['rev', missed ? 'rev--miss' : ''].filter(Boolean).join(' ')}
      id={`q${String(position).padStart(2, '0')}`}
      aria-label={`Question ${String(position)}`}
    >
      <div className="rev__top">
        <span className="rev__n">{String(position).padStart(2, '0')}</span>
        {answer ? (
          <span className={`verdict ${missed ? 'verdict--bad' : 'verdict--ok'}`}>
            {missed ? <IconX size={13} /> : <IconCheck size={13} />}
            {missed ? 'Missed' : 'Correct'}
          </span>
        ) : (
          <span className="verdict faint">Never asked</span>
        )}
        <span className="rev__area">{areaLabel(item.area)}</span>
        {correctionSummary && (
          <Link className="tagx" to="/settings" title={correctionSummary}>
            Corrected since 2022
          </Link>
        )}
      </div>

      <p className="rev__stem">
        {question?.stem ?? 'This question is not in this build of the question bank.'}
      </p>

      {answer && !missed && (
        <div className="ans">
          <p className="ans__lab">
            {`You picked ${optionLetter(question, answer.chosenIndex)} — and it was the correct answer`}
          </p>
          <p className="ans__val read">
            <span className="k k--ok" aria-hidden="true">
              {optionLetter(question, answer.chosenIndex)}
            </span>
            {optionText(question, answer.chosenIndex)}
          </p>
        </div>
      )}

      {answer && missed && (
        <>
          <div className="ans">
            <p className="ans__lab">You picked</p>
            <p className="ans__val read">
              <span className="k k--bad" aria-hidden="true">
                {optionLetter(question, answer.chosenIndex)}
              </span>
              {optionText(question, answer.chosenIndex)}
            </p>
          </div>
          <div className="ans">
            <p className="ans__lab">Correct answer</p>
            <p className="ans__val read">
              <span className="k k--ok" aria-hidden="true">
                {optionLetter(question, correctIndex)}
              </span>
              {optionText(question, correctIndex)}
            </p>
          </div>
        </>
      )}

      {!answer && (
        <div className="ans">
          <p className="ans__lab">Correct answer</p>
          <p className="ans__val read">
            <span className="k k--ok" aria-hidden="true">
              {optionLetter(question, correctIndex)}
            </span>
            {optionText(question, correctIndex)}
          </p>
        </div>
      )}

      {question && <p className="read mt-2.5">{question.explanation}</p>}

      {citation && (
        <p className="rev__cite">
          <IconBook size={12} />
          {citationLine(areaLabel(item.area), citation)}
        </p>
      )}
    </article>
  );
}
