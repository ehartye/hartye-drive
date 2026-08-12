import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  AppBar,
  Button,
  Chip,
  ProgressRail,
  RouteShield,
  SearchField,
  SignSvg,
} from '~/components';
import { IconArrowRight } from '~/components/Icon';
import { usePageTitle } from '~/app/usePageTitle';
import { allSigns } from '~/signs/signs';
import type { SignEntry } from '~/signs/registry';
import { shakySignIds, summariseSignMastery } from '~/domain/sign-progress';
import { useSignStore } from '~/store/signs';
import { SIGN_CATEGORIES, categoryLabel, categoryMeta } from './signs/categories';
import { matchesSignQuery, nearMissFor } from './signs/search';
import { CategoryHead, CategoryLinks, ColorKey, SignCard, SignDetail } from './signs/parts';

/**
 * How many of a category's signs the default view shows before it offers the
 * rest. Four fills two rows at 390px and keeps the whole library scannable in
 * one scroll; filtering or searching drops the cap entirely, because a learner
 * who has asked for warning signs wants the warning signs.
 */
const PREVIEW_PER_CATEGORY = 4;

const TOTAL = allSigns.length;

/**
 * The sign library.
 *
 * Grouped by MUTCD category, and each category leads with the **rule its shape
 * and colour carry**, stated as a lesson rather than a label. A learner should
 * leave this page able to read a sign they have never seen: yellow diamond is a
 * warning, orange is a work zone, red is a prohibition, five sides is a school.
 *
 * Search, the category filter, the expanded view and the open sign all live in
 * the URL. That makes every state of this screen linkable and back-navigable,
 * and it is what lets a reviewer land directly on the empty-filter state.
 */
export function SignsLibrary() {
  usePageTitle('Sign library');
  const [params, setParams] = useSearchParams();
  const record = useSignStore((s) => s.record);
  const storageMode = useSignStore((s) => s.storageMode);

  const query = params.get('q') ?? '';
  const category = params.get('cat');
  const openId = params.get('sign');

  /* Filtering already narrows the page, so the per-category cap only applies to
     the unfiltered default view. Asking for "warning" and getting four of the
     thirty-three would be a bug, not a preview. */
  const filtering = query.trim() !== '' || category !== null;
  const expanded = filtering || params.get('expand') === 'all';

  const set = (patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace });
  };

  const summary = useMemo(
    () => summariseSignMastery(record.cards, allSigns.map((sign) => sign.id)),
    [record.cards],
  );
  const shaky = useMemo(
    () => shakySignIds(record.cards, allSigns.map((sign) => sign.id)),
    [record.cards],
  );

  const matches = useMemo(
    () =>
      allSigns.filter(
        (sign) =>
          (category === null || sign.category === category) && matchesSignQuery(sign, query),
      ),
    [query, category],
  );

  const totalByCategory = useMemo(() => countByCategory(allSigns), []);
  const matchedByCategory = useMemo(() => countByCategory(matches), [matches]);

  const groups = SIGN_CATEGORIES.map((meta) => ({
    meta,
    signs: matches.filter((sign) => sign.category === meta.id),
  })).filter((group) => group.signs.length > 0);

  const openSign = openId === null ? undefined : allSigns.find((sign) => sign.id === openId);
  const nearMiss = matches.length === 0 ? nearMissFor(query) : undefined;
  const nearMissSign = nearMiss ? allSigns.find((sign) => sign.id === nearMiss.signId) : undefined;

  return (
    <>
      <AppBar
        title="Signs"
        context={`${String(TOTAL)} signs · ${String(summary.solid)} solid`}
      />

      <main className="wrap stack pt-6">
        <section>
          <p className="eyebrow">Every sign on a Tennessee road</p>
          {/* tabIndex -1: "Back to the top" has to land focus somewhere, and
              scrolling without moving focus strands a keyboard learner. */}
          <h1 id="library-top" tabIndex={-1}>
            Sign library
          </h1>
          <p className="dim mt-2 text-[0.9375rem]">
            Learn the shape and the color first. They tell you what a sign is before you can read a
            word of it.
          </p>
        </section>

        <MasterySummary
          solid={summary.solid}
          review={summary.review}
          unseen={summary.unseen}
          total={summary.total}
          percent={summary.percentSolid}
        />

        <section
          className={matches.length === 0 ? 'filters filters--miss' : 'filters'}
          aria-label="Find a sign"
        >
          <SearchField
            label="Search signs by name, shape, or color"
            placeholder="Search — name, shape, or color"
            value={query}
            onChange={(value) => {
              set({ q: value }, true);
            }}
          />
          <div className="chips" role="group" aria-label="Filter by sign category">
            <Chip
              pressed={category === null}
              onToggle={() => {
                set({ cat: null });
              }}
            >
              {`All ${String(TOTAL)}`}
            </Chip>
            {SIGN_CATEGORIES.map((meta) => (
              <Chip
                key={meta.id}
                pressed={category === meta.id}
                dotColor={meta.swatch}
                onToggle={(pressed) => {
                  set({ cat: pressed ? meta.id : null });
                }}
              >
                {meta.label}
              </Chip>
            ))}
          </div>
          {/* Announced, not merely re-rendered: a filter that silently empties
              the page tells a screen-reader user nothing (practices A9). */}
          <p className="sr-only" role="status" aria-live="polite">
            {matches.length === 0
              ? 'No signs match. Recovery options follow.'
              : `${String(matches.length)} of ${String(TOTAL)} signs shown.`}
          </p>
        </section>

        {matches.length === 0 ? (
          <NoMatches
            query={query}
            category={category}
            nearMiss={nearMiss ? { ...nearMiss, sign: nearMissSign } : undefined}
            counts={totalByCategory}
            onClearAll={() => {
              set({ q: null, cat: null });
            }}
            onDropCategory={() => {
              set({ cat: null });
            }}
            onPickCategory={(id) => {
              set({ q: null, cat: id });
            }}
          />
        ) : (
          <>
            <ColorKey />

            {!filtering && (
              <Button
                variant="quiet"
                block
                onClick={() => {
                  set({ expand: expanded ? null : 'all' });
                }}
              >
                {expanded
                  ? 'Collapse back to a preview of each category'
                  : `Show every one of the ${String(TOTAL)} signs at once`}
              </Button>
            )}

            {groups.map((group) => {
              const shown = expanded ? group.signs : group.signs.slice(0, PREVIEW_PER_CATEGORY);
              const headingId = `cat-${group.meta.id}`;
              return (
                <section
                  key={group.meta.id}
                  className={`cat cat--${group.meta.id}`}
                  id={headingId}
                  aria-labelledby={`${headingId}-h`}
                >
                  <CategoryHead
                    meta={group.meta}
                    shown={shown.length}
                    total={
                      filtering
                        ? (matchedByCategory[group.meta.id] ?? 0)
                        : (totalByCategory[group.meta.id] ?? 0)
                    }
                    headingId={`${headingId}-h`}
                  />
                  <div className="signgrid">
                    {shown.map((sign) => (
                      <SignCard
                        key={sign.id}
                        sign={sign}
                        card={record.cards[sign.id]}
                        onOpen={(id) => {
                          set({ sign: id });
                        }}
                      />
                    ))}
                  </div>
                  {shown.length < group.signs.length && (
                    <div className="catmore">
                      <Button
                        variant="quiet"
                        block
                        onClick={() => {
                          set({ cat: group.meta.id });
                        }}
                      >
                        {`Show all ${String(group.signs.length)} ${group.meta.label.toLowerCase()} signs`}
                      </Button>
                    </div>
                  )}
                </section>
              );
            })}

            <hr className="centreline" />

            <Button variant="guide" block to={drillHref(category, shaky.length)}>
              {shaky.length > 0
                ? `Drill the ${String(shaky.length)} sign${shaky.length === 1 ? '' : 's'} you're shaky on`
                : category
                  ? `Drill the ${categoryLabel(category).toLowerCase()} signs`
                  : 'Start a sign drill'}
              <IconArrowRight size={18} />
            </Button>

            {expanded && !filtering && (
              <div className="flex justify-center">
                {/* No smooth scroll: motion is never decorative here (A13). */}
                <Button
                  variant="quiet"
                  onClick={() => {
                    window.scrollTo(0, 0);
                    document.getElementById('library-top')?.focus();
                  }}
                >
                  Back to the top
                </Button>
              </div>
            )}
          </>
        )}

        {storageMode === 'session-only' && (
          <p className="faint text-[0.75rem] text-center leading-normal">
            This device is not letting the app save anything, so which signs you have learned will
            not be remembered after you close the tab.
          </p>
        )}

        <p className="faint text-[0.75rem] text-center leading-normal">
          Shapes and colors follow the federal MUTCD as adopted by Tennessee.
          <br />
          Not affiliated with the State of Tennessee.
        </p>
      </main>

      <SignDetail
        sign={openSign}
        card={openSign ? record.cards[openSign.id] : undefined}
        onClose={() => {
          set({ sign: null });
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------- sub-screens */

interface MasterySummaryProps {
  solid: number;
  review: number;
  unseen: number;
  total: number;
  percent: number;
}

function MasterySummary({ solid, review, unseen, total, percent }: MasterySummaryProps) {
  /* Nothing drilled yet is not a score of zero, and drawing it as one reads as
     a failure the learner has not earned. It is an invitation (practices C3). */
  if (solid === 0 && review === 0) {
    return (
      <section className="panel panel--flat" aria-label="Your signs">
        <p className="eyebrow mb-1">Your signs</p>
        <p className="dim text-[0.9375rem] m-0">
          {`You haven't drilled any of the ${String(total)} signs yet. The drill shows one sign at a time with no label on it — which is exactly how you meet one on the road.`}
        </p>
      </section>
    );
  }

  return (
    <section className="panel panel--flat" aria-label="Your signs">
      <div className="spread mb-2.5">
        <div>
          <p className="eyebrow mb-1">Your signs</p>
          <p className="dim text-[0.875rem] m-0">
            <span className="num text-sign-white font-bold">{solid}</span>
            {' solid · '}
            <span className="num text-warning font-bold">{review}</span>
            {' need review · '}
            <span className="num">{unseen}</span>
            {' not seen yet'}
          </p>
        </div>
        <RouteShield
          value={solid}
          locked={solid === 0}
          label={`${String(solid)} of ${String(total)} signs solid`}
        />
      </div>
      <ProgressRail
        value={solid}
        max={total}
        label={`${String(solid)} of ${String(total)} signs solid, ${String(percent)} percent`}
      />
    </section>
  );
}

interface NoMatchesProps {
  query: string;
  category: string | null;
  nearMiss: { signId: string; note: string; sign: SignEntry | undefined } | undefined;
  counts: Record<string, number>;
  onClearAll: () => void;
  onDropCategory: () => void;
  onPickCategory: (id: string) => void;
}

/**
 * The empty filter. Every action here goes somewhere real — the mockup's rule
 * (state-matrix note 13) is that "no results" is not a state, it is a shrug.
 */
function NoMatches({
  query,
  category,
  nearMiss,
  counts,
  onClearAll,
  onDropCategory,
  onPickCategory,
}: NoMatchesProps) {
  const label = category ? categoryLabel(category) : null;
  return (
    <>
      <section className="state state--miss">
        <span className="state__art" aria-hidden="true">
          <SignSvg id="d1-1-destination" size="xl" decorative />
        </span>
        <h2>
          {query.trim() === '' ? (
            `Nothing in ${label ?? 'this filter'} yet`
          ) : (
            <>
              {'Nothing matches '}
              <span className="state__q">{`“${query}”`}</span>
              {label ? ` in ${label}` : ''}
            </>
          )}
        </h2>

        {nearMiss ? (
          <p className="read max-w-[34ch] mx-auto mb-6">{nearMiss.note}</p>
        ) : (
          <p className="read max-w-[34ch] mx-auto mb-6">
            Nothing in the registry carries that word. Search reads names, shapes, colors and
            meanings — so a sign you half remember is usually two words away.
          </p>
        )}

        <div className="state__acts">
          {nearMiss?.sign && (
            <Button variant="guide" block to={`/signs?sign=${encodeURIComponent(nearMiss.signId)}`}>
              {`Open the ${nearMiss.sign.name} sign`}
            </Button>
          )}
          <Button variant="quiet" block onClick={onClearAll}>
            {`Clear the search and show all ${String(TOTAL)} signs`}
          </Button>
          {label && query.trim() !== '' && (
            <Button variant="quiet" block onClick={onDropCategory}>
              {`Keep the search, drop the ${label} filter`}
            </Button>
          )}
        </div>

        <p className="faint text-[0.8125rem] max-w-[34ch] mx-auto mt-5 leading-normal">
          Search also reads shapes and colors. Try <b>octagon</b>, <b>pentagon</b>, <b>orange</b>,
          or <b>blue</b>.
        </p>
      </section>

      <hr className="centreline" />

      <section className="recover" aria-labelledby="recover-h">
        <h3 id="recover-h" className="mb-3">
          Or start from a category
        </h3>
        <CategoryLinks counts={counts} onPick={onPickCategory} />
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ helpers */

function countByCategory(signs: readonly SignEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sign of signs) out[sign.category] = (out[sign.category] ?? 0) + 1;
  return out;
}

/**
 * The drill inherits whatever the library is looking at: a category filter
 * carries through, and the shaky-signs call to action leaves it off so the
 * scheduler can pick across the whole registry.
 */
function drillHref(category: string | null, shakyCount: number): string {
  if (shakyCount > 0) return '/signs/drill';
  return category && categoryMeta(category)
    ? `/signs/drill?cat=${encodeURIComponent(category)}`
    : '/signs/drill';
}
