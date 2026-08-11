# Executable Floor — exact commands and thresholds

Binary pass/fail. A critic runs these itself and pastes the output verbatim
into `ledger.md`. No threshold here is negotiable mid-loop; disputes go to
`deviations.md`.

All commands run from the repo root on Windows (PowerShell or Git Bash).

---

## 1. Build & type safety

| # | Command | Threshold |
|---|---|---|
| X1 | `npm run typecheck` | exit 0, zero errors |
| X2 | `npm run lint` | exit 0, zero errors, zero warnings |
| X3 | `npm run build` | exit 0, no TypeScript errors, no unresolved imports |

## 2. Tests

| # | Command | Threshold |
|---|---|---|
| X4 | `npm test` (Vitest, run mode) | all pass, zero skipped without a cited reason |
| X5 | `npm run test:coverage` | **≥90% line and branch coverage on `src/domain/`** (scoring, scheduling, adaptive selection, migrations). UI coverage is deliberately not gated. |
| X6 | `npm run test:e2e` (Playwright) | all pass |

The domain coverage floor is set high and narrow on purpose: the exam scoring
rules, the spaced-repetition scheduler, and the storage migrations are where a
silent bug costs a learner a real test attempt. Component coverage targets are
excluded as a ratified exclusion — they buy less than they cost.

## 3. Content validation

| # | Command | Threshold |
|---|---|---|
| X7 | `npm run validate:content` | exit 0 |

The validator must enforce, and must be demonstrated failing on a deliberately
broken fixture:
- every question has ≥1 citation with a manual page number and a quote;
- every quote appears **verbatim** in `docs/research/tn-dl-manual-extract.txt`;

> **Matching rule (do not get this wrong).** The extract preserves the PDF's
> line breaks, so a quote spanning two lines will never match by naive
> substring search. Normalize **both** the quote and the source — collapse all
> whitespace runs to a single space, normalize curly quotes/apostrophes and
> en/em dashes to ASCII, then match case-sensitively. The validator must ship
> with a test proving a known line-spanning quote matches.

- exactly one correct answer per question; no duplicate choice text;
- **2 ≤ options ≤ 4, and ≥80% of questions have exactly 3** (the real format);
- every question's topic exists in the topic taxonomy and maps to one of the four blueprint areas;
- every question's source section is B or C, never A;
- every sign referenced by a question exists in the sign registry;
- the 27 official sample questions are present and flagged `official: true`;
- no question id collisions.

**Minimum content volume** (below this the app is a demo, not a product):
- **≥300 questions** across ≥12 topics, no topic with fewer than 10.
- Every one of the four blueprint areas has **≥60 questions**, so a 25/25/25/25 mock exam never repeats within a session.
- **≥80 signs** in the registry, each with shape, category, color, meaning, and a manual citation.

**Blueprint conformance** — `npm run validate:content` also reports the
generated-exam topic mix. Ten simulated exams must land within **±1 question**
of 7/8/7/8 per area (30 × 25%).

## 3b. Sign registry audit — added after three sign errors in three critic rounds

| # | Command | Threshold |
|---|---|---|
| X7b | `npm run audit:signs` | exit 0 |

Phase 1 shipped a school sign in the wrong color, a railroad advance-warning with
a `+` instead of an `X`, and a YIELD with its colors inverted — each caught only
because a critic happened to look closely. Review is not a control for this.
**The registry must be machine-checked**, and the harness must:

- render **every** sign to a contact sheet at ≥200px (`npm run audit:signs -- --sheet`) so a human can scan the whole registry in one image;
- require, per entry: MUTCD designation (e.g. `R1-2`, `W10-1`), category, shape, the exact face and legend colors, meaning, and a manual citation — **a sign with no MUTCD designation fails the build**;
- assert every declared color appears in the rendered SVG, and that no color outside the declared palette does (this alone would have caught the pink school sign);
- assert **legend containment**: every `<text>` node's rendered bounding box lies inside its face geometry (this would have caught ONE WAY, NO PASSING ZONE, and the crossbuck);
- assert the accessible name states shape **and** color **and** meaning — except in drill mode, where meaning must be absent;
- fail on any sign whose declared meaning contradicts the meaning of a question that references it.

Sign correctness is the product's central claim. It gets a build gate, not a
code review.

## 4. Bundle size

| # | Command | Threshold |
|---|---|---|
| X8 | `npm run size` (reports gzipped bytes per chunk) | initial JS ≤ **180 KB** gzipped, excluding the question bank chunk |
| X9 | `npm run size` total precached payload | ≤ **2.5 MB** |

## 5. Lighthouse (production build, mobile emulation)

Command: `npm run audit` → runs `npm run build`, serves `dist/` on port 4173,
runs Lighthouse headless, writes `lighthouse-report.json` + `.html`.

| # | Category | Threshold |
|---|---|---|
| X10 | Performance | ≥ 90 |
| X11 | Accessibility | **= 100** |
| X12 | Best Practices | ≥ 95 |
| X13 | SEO | ≥ 90 |
| X14 | Installable PWA | passes (valid manifest + service worker) |

## 6. Accessibility scanner

| # | Command | Threshold |
|---|---|---|
| X15 | `npm run test:a11y` — axe-core via Playwright across **every route and every state-matrix cell** | **zero violations** at `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` |

Lighthouse's a11y score alone is not sufficient — it samples. X15 is the real
gate and must cover the cells enumerated in `state-matrix.md`.

## 7. Offline — the hard requirement

| # | Check | Threshold |
|---|---|---|
| X16 | Build, `npm run preview`, load once, set browser offline, hard-reload | app boots fully |
| X17 | While offline: complete a study question, run a full 30-question exam, open the sign library, view progress | all work, zero failed network requests |
| X18 | Network panel after first load, during a full session | **zero** outbound requests |

Automated as a Playwright spec using `context.setOffline(true)`; the critic must
also confirm it by hand at least once.

## 8. Resilience

| # | Check | Threshold |
|---|---|---|
| X19 | Write `{"garbage":true}` into the persisted `localStorage` key, reload | recoverable error screen, not a white screen or a boot loop |
| X20 | Set `schemaVersion` to a far-future integer, reload | recoverable screen offering a reset |
| X21 | Stub `localStorage.setItem` to throw, load the app | session-only mode is offered; no unhandled rejection |
| X22 | Complete a full study session and a full exam in the production build | **zero** console errors or warnings |

## 9. Startup performance

| # | Check | Threshold |
|---|---|---|
| X23 | Cold load on Slow-4G + 4× CPU throttle, production build | first question interactive ≤ **2.5 s** |

---

## Required npm scripts

The build must expose exactly these, so a critic never has to guess:

```
dev · build · preview · typecheck · lint · test · test:coverage
test:e2e · test:a11y · validate:content · size · audit · verify
```

`npm run verify` runs X1–X8 and X15 in sequence and is the single command that
answers "does this meet the executable floor?"
