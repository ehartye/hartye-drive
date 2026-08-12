import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AppBar,
  Button,
  ErrorState,
  LoadingSkeleton,
  SignPanel,
  SignSvg,
  TopicMeter,
} from '~/components';
import { IconArrowRight, IconCheck, IconChevronRight, IconX } from '~/components/Icon';
import { usePageTitle } from '~/app/usePageTitle';
import { practiceHref, ruleHref } from '~/app/hrefs';
import { correctionById, loadQuestionBank, loadRules, loadSignRegistry, topicById } from '~/content';
import type { Correction, ManualRule, Question, SignEntry } from '~/content';
import { buildRuleReference } from '~/domain/rule-reference';
import type { RuleReference as RuleReferenceModel } from '~/domain/rule-reference';
import { masteryPercent } from '~/domain/mastery';
import { useProgressStore } from '~/store/progress';
import { formatFullDate } from './progress/format';

interface Loaded {
  rules: ManualRule[];
  questions: Question[];
  signs: Map<string, SignEntry>;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: Loaded }
  | { status: 'error'; detail: string };

/**
 * `/rules/:id` — the page a citation resolves to.
 *
 * Every explanation in this product ends in a citation, and until this route
 * existed a citation was a footnote: a page number a learner could read but not
 * follow. This is the other end of it — the rule stated plainly, the manual's
 * own words with **both** page numbers, the signs that carry it, the rest of
 * the topic, the questions built on it, and a way to go and practise.
 *
 * The two large content files are loaded here rather than in the shell, so a
 * learner who never follows a citation never downloads them. The whole route is
 * code-split for the same reason.
 */
export function RuleReference() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const cards = useProgressStore((s) => s.progress.cards);
  const topicStats = useProgressStore((s) => s.progress.topics);

  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    Promise.all([loadRules(), loadQuestionBank(), loadSignRegistry()])
      .then(([rules, bank, registry]) => {
        if (!live) return;
        setState({
          status: 'ready',
          data: {
            rules,
            questions: bank.questions,
            signs: new Map(registry.signs.map((sign) => [sign.id, sign])),
          },
        });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({
          status: 'error',
          detail: error instanceof Error ? error.message : 'The manual rules could not be read.',
        });
      });
    return () => {
      live = false;
    };
  }, []);

  const reference =
    state.status === 'ready'
      ? buildRuleReference({
          ruleId: id,
          rules: state.data.rules,
          questions: state.data.questions,
          cards,
        })
      : null;

  usePageTitle(reference ? `${reference.rule.topic} · rule reference` : 'Rule reference');

  const goBack = () => {
    void navigate(-1);
  };

  if (state.status === 'loading') {
    return (
      <>
        <AppBar title="Rule reference" onBack={goBack} />
        <main className="wrap stack pt-6">
          <h1>Rule reference</h1>
          <SignPanel flat>
            <LoadingSkeleton lines={4} label="Loading the manual rule" />
          </SignPanel>
        </main>
      </>
    );
  }

  if (state.status === 'error') {
    return (
      <>
        <AppBar title="Rule reference" onBack={goBack} />
        <main className="wrap stack pt-6">
          <ErrorState
            headingLevel={1}
            title="This rule would not load"
            body="The manual rules are part of the app and ship with it, so this is a fault in the app rather than anything you did."
            detail={state.detail}
            onRetry={() => {
              window.location.reload();
            }}
            secondaryAction={
              <Button variant="quiet" to="/study">
                Back to studying
              </Button>
            }
          />
        </main>
      </>
    );
  }

  if (!reference) {
    return (
      <>
        <AppBar title="Rule reference" onBack={goBack} />
        <main className="wrap stack pt-6">
          <ErrorState
            headingLevel={1}
            title="No such rule"
            body={`Nothing in the manual is filed under “${id}”. Citations inside the app always resolve; a hand-typed address may not.`}
            secondaryAction={
              <Button variant="guide" to="/study">
                Back to studying
              </Button>
            }
          />
        </main>
      </>
    );
  }

  return (
    <Reference
      reference={reference}
      data={state.data}
      topicStat={
        reference.primaryTopic ? topicStats[reference.primaryTopic] : undefined
      }
      onBack={goBack}
    />
  );
}

/* --------------------------------------------------------------- the page */

interface ReferenceProps {
  reference: RuleReferenceModel;
  data: Loaded;
  topicStat: { seen: number; correct: number } | undefined;
  onBack: () => void;
}

function Reference({ reference, data, topicStat, onBack }: ReferenceProps) {
  const { rule } = reference;
  const topic = reference.primaryTopic ? topicById(reference.primaryTopic) : undefined;
  const signs = reference.signIds
    .map((signId) => data.signs.get(signId))
    .filter((sign): sign is SignEntry => sign !== undefined);
  const corrections = reference.correctionIds
    .map((correctionId) => correctionById(correctionId))
    .filter((correction): correction is Correction => correction !== undefined);

  const siblings = reference.siblingRuleIds
    .map((siblingId) => data.rules.find((candidate) => candidate.id === siblingId))
    .filter((sibling): sibling is ManualRule => sibling !== undefined);

  const hero = signs[0];

  return (
    <>
      <AppBar title="Rule reference" context={rule.topic} onBack={onBack} />

      <main className="wrap stack pt-6">
        <section className="row items-start gap-4">
          {hero && <SignSvg id={hero.id} size="lg" className="flex-none" />}
          <div className="min-w-0">
            <p className="eyebrow eyebrow--warning">Rule reference</p>
            <h1>{rule.topic}</h1>
            <p className="dim mt-2 text-[0.8125rem]">{rule.group}</p>
          </div>
        </section>

        <SignPanel as="section" aria-labelledby="rule-h">
          <p className="eyebrow mb-2" id="rule-h">
            The rule
          </p>
          <p className="plain">{rule.rule}</p>
        </SignPanel>

        <SignPanel as="section" flat aria-labelledby="quote-h">
          <p className="eyebrow mb-2.5" id="quote-h">
            What the manual says
          </p>
          <blockquote className="cite m-0">
            {reference.quotes.map((quote) => (
              <p className="cite__quote" key={quote}>
                {`“${quote}”`}
              </p>
            ))}
            <cite className="cite__src">
              {`Tennessee Comprehensive Driver License Manual · ${rule.group} · PDF p. ${String(
                rule.pdfPage,
              )}${rule.printedPage === null ? '' : ` (printed p. ${String(rule.printedPage)})`}`}
            </cite>
          </blockquote>

          {corrections.length === 0 && (
            <p className="srcnote mt-4">
              <span>
                <span className="badge badge--live mr-1.5">Verified</span>
                Checked against current Tennessee law · no correction on file
              </span>
            </p>
          )}
        </SignPanel>

        {corrections.map((correction) => (
          <SignPanel as="section" variant="work" key={correction.id}>
            <p className="eyebrow eyebrow--work mb-1.5">
              {`Corrected since the manual · in force ${formatFullDate(correction.effectiveDate)}`}
            </p>
            <p className="read m-0">{correction.summary}</p>
            <dl className="corr__d mt-3 mb-0">
              {correction.manualStates !== null && (
                <>
                  <dt>Manual</dt>
                  <dd>{correction.manualStates}</dd>
                </>
              )}
              <dt>We teach</dt>
              <dd>{correction.currentlyTrue}</dd>
              <dt>Authority</dt>
              <dd>{correction.authority}</dd>
            </dl>
          </SignPanel>
        ))}

        {siblings.length > 0 && (
          <section aria-labelledby="also-h">
            <h2 className="mb-3.5" id="also-h">
              What else this topic requires of you
            </h2>
            <ul className="rulelist">
              {siblings.map((sibling) => (
                <li key={sibling.id}>
                  <Link
                    className="font-ui font-extrabold text-sign-white underline underline-offset-4"
                    to={ruleHref(sibling.id)}
                  >
                    {sibling.topic}
                  </Link>
                  {` — ${sibling.rule}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {signs.length > 0 && (
          <section aria-labelledby="signs-h">
            <h2 className="mb-3.5" id="signs-h">
              {reference.signsAreDirect ? 'Signs that carry this rule' : 'Signs this topic teaches'}
            </h2>
            <div className="relsigns">
              {signs.map((sign) => (
                <Link className="relsign" key={sign.id} to={`/signs?sign=${sign.id}`}>
                  <span className="relsign__face">
                    <SignSvg id={sign.id} size="lg" />
                  </span>
                  <span className="relsign__n">{sign.name}</span>
                  <p className="relsign__s">{sign.meaning}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {topic && topicStat && topicStat.seen > 0 && (
          <SignPanel
            as="section"
            variant={
              masteryPercent(topicStat.correct, topicStat.seen) >= 80 ? 'guide' : 'warn'
            }
            aria-labelledby="record-h"
          >
            <p className="eyebrow mb-2.5" id="record-h">
              Your record on this topic
            </p>
            <TopicMeter
              name={topic.label}
              correct={topicStat.correct}
              total={topicStat.seen}
            />
          </SignPanel>
        )}

        {reference.practiceQuestionIds.length > 0 && topic && (
          <div>
            <Button variant="guide" block to={practiceHref(reference.practiceQuestionIds)}>
              {`Practice ${topic.label.toLowerCase()} — ${String(
                Math.min(12, reference.practiceQuestionIds.length),
              )} questions`}
              <IconArrowRight size={18} />
            </Button>
          </div>
        )}

        {reference.questions.length > 0 && (
          <>
            <hr className="centreline" />
            <section aria-labelledby="q-h">
              <h2 className="mb-3.5" id="q-h">
                Questions that cite this rule
              </h2>
              {reference.questions.map((question) => (
                <Link
                  className={`qrow ${
                    question.recall === 'missed'
                      ? 'qrow--missed'
                      : question.recall === 'right'
                        ? 'qrow--ok'
                        : ''
                  }`}
                  key={question.id}
                  to={practiceHref([question.id])}
                >
                  <span className="qrow__t">
                    <span className="qrow__q">{question.stem}</span>
                    <span className="qrow__s">
                      {question.recall === 'missed' ? (
                        <IconX size={12} />
                      ) : question.recall === 'right' ? (
                        <IconCheck size={12} />
                      ) : (
                        <IconChevronRight size={12} />
                      )}
                      {question.recallLabel}
                    </span>
                  </span>
                  <IconChevronRight size={18} className="qrow__chev" />
                </Link>
              ))}
              {reference.questionCount > reference.questions.length && (
                <p className="dim text-[0.8125rem] mt-3">
                  {`Showing ${String(reference.questions.length)} of ${String(reference.questionCount)} questions built on this rule.`}
                </p>
              )}
            </section>
          </>
        )}

        <SignPanel as="section" flat aria-labelledby="src-h">
          <p className="eyebrow mb-2.5" id="src-h">
            Where this came from
          </p>
          <p className="srcnote">
            <span>Tennessee Comprehensive Driver License Manual</span>
            <span>
              TN Dept. of Safety &amp; Homeland Security · content current as of 1 July 2022
            </span>
            <span>
              {`${rule.group} · PDF p. ${String(rule.pdfPage)}${
                rule.printedPage === null ? '' : ` · printed p. ${String(rule.printedPage)}`
              }`}
            </span>
            <span>{`Rule ${rule.id}`}</span>
          </p>
          <p className="dim mt-3.5 text-[0.8125rem] leading-relaxed">
            Where Tennessee law has changed since the manual was published, TN&nbsp;Drive shows the
            correction beside the quotation rather than editing it.{' '}
            <Link className="citelink normal-case" to="/settings">
              Every correction we apply
            </Link>
          </p>
        </SignPanel>

        <p className="faint text-[0.75rem] text-center leading-normal">
          Not affiliated with the State of Tennessee.
        </p>
      </main>
    </>
  );
}
