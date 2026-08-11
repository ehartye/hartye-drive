# Phase 2 Decomposition — judgeable pieces

One piece = **one thing a blind critic can pass or fail independently**, with
its own evidence. Each piece names the bar artifacts it is judged against and
exactly how the critic perceives it.

Rounds cap: **3 per piece.** Stall: 2 consecutive rounds with no
critic-acknowledged improvement → escalate.

---

## Dependency order

```
P1 foundation
 ├── P2 content pipeline ──┐
 ├── P3 sign system ───────┤
 │                         ├── P4 study + adaptive engine
 │                         ├── P5 exam simulator
 │                         └── P6 sign trainer + library
 ├── P7 dashboard + onboarding
 └── P8 progress + settings + rule reference
                                   │
                          P9 offline/PWA + resilience
                                   │
                          P10 practices + executable sweep
```

P2 and P3 may run in parallel once P1 passes. P4–P8 may run in parallel once
P1–P3 pass. P9 and P10 are last because they judge the assembled app.

---

## P1 — Foundation & design system

**Builds:** Vite 7 + React 19 + TS strict scaffold; Tailwind v4 `@theme` token
layer transcribed from `stack-grounding.md` §2; self-hosted Overpass / Overpass
Mono / Newsreader woff2; the component vocabulary from §3 as real components;
routing + `AppNav` (bottom bar / side rail); the npm scripts from
`executable-floor.md`; a `/gallery` dev route rendering every primitive in
every state.

**Judged against:** `stack-grounding.md` §§1–5, 9 · `executable-floor.md`
X1–X3 · `practices-checklist.md` A6, A12, A13, E1, E2, F5.

**Critic perceives by:** running `npm run typecheck && npm run lint && npm run
build`; launching `npm run dev` and screenshotting `/gallery` at 390px, 320px,
and 1440px; tabbing through it; emulating `prefers-reduced-motion`; grepping
for `fonts.googleapis.com` and `outline:none`.

**Pass:** every §3 component exists and is visually consistent with
`mockups/_base.css`; tokens match §2 exactly; builds clean; no CDN font
request; focus visible everywhere.

---

## P2 — Content pipeline & question bank

**Builds:** typed content schema; `npm run validate:content`; the topic
taxonomy; and **≥300 questions across ≥12 topics (≥10 each)**, each with a
manual page number and a verbatim supporting quote, sourced from
`docs/research/manual-spine.md` and corrected by `docs/research/live-facts.md`.

**Judged against:** `practices-checklist.md` D1–D4, D6, D8, E5 ·
`executable-floor.md` X7.

**Critic perceives by:** running `npm run validate:content`; deliberately
breaking a fixture to prove the validator fails; **independently sampling 15
random questions** and checking each quote verbatim against the extracted
manual text and each quote against its keyed answer; counting questions per
topic.

**Pass:** validator green, provably strict, and all 15 sampled questions
survive audit. **Any sampled question whose quote does not support its answer
fails the piece** — this is the item that makes the app trustworthy.

---

## P3 — Sign system

**Builds:** `SignSvg` + a registry of **≥80 signs**, each with spec-accurate
hand-authored SVG geometry, MUTCD category, shape, color, meaning, and a manual
citation. Accessible names describing shape + color + meaning.

**Judged against:** `practices-checklist.md` D5, A8 · `stack-grounding.md` §2
signature.

**Critic perceives by:** rendering the full registry to a page, screenshotting
it, and checking a sample against the manual's signs chapter in
`docs/research/manual-spine.md` for correct shape, color, and meaning;
inspecting the a11y tree for names.

**Pass:** ≥80 signs, `npm run audit:signs` green (see `executable-floor.md`
§3b), sampled signs geometrically and semantically correct, no clipart or raster
anywhere, accessible names present and correct.

**Note to the builder — read this.** The Phase-1 mockup sprite is a 22-sign
subset and is **not** the art to copy. Three of its signs were factually wrong
before they were caught (school in pink, W10-1 as a `+`, R1-2 inverted). Author
the registry from `docs/research/manual-spine.md` and the MUTCD designation,
not from `mockups/_signs.js`. Use the sprite only for *treatment* — the
retroreflective sheen, sizing classes, and how signs sit in the layout.

---

## P4 — Study session & adaptive engine

**Builds:** the study flow; `ChoiceRow` states; `ExplanationBlock` with rule +
verbatim quote + citation; and the spaced-repetition / weakness-targeting
scheduler as a **pure module under `src/domain/`, unit-tested without a DOM**.

**Judged against:** mockups `03-study-question`, `04a-study-correct`,
`04b-study-incorrect` · matrix cells 3 and 4 (incl. long-content) ·
`executable-floor.md` X4, X5 · `practices-checklist.md` A3, A4, A9, E6.

**Critic perceives by:** driving the real app into each state with Playwright
and screenshotting side-by-side against the mockups; completing a question with
the keyboard only; grayscaling the answer-revealed screens to confirm meaning
survives; running the scheduler's unit tests; checking `src/domain/` coverage.

**Pass:** all three cells match at intent parity, long-content holds at 320px,
scheduler tested ≥90%, correct/incorrect legible without color.

---

## P5 — Exam simulator & score reports

**Builds:** faithful TN simulation — 30 questions, 24 to pass, 60-minute timer,
**early termination at 7 wrong**, no back-navigation, no explanations during
the exam, guarded exit; and the three score reports.

**Judged against:** mockups `05-exam-inprogress`, `06a-exam-passed`,
`06b-exam-failed`, `06c-exam-ended-early` · matrix cells 5 and 6 ·
`practices-checklist.md` D8, A15, A16.

**Critic perceives by:** running three full exams end to end — one passing,
one failing, one deliberately answering 7 wrong to force early termination —
screenshotting each report; attempting browser-back mid-exam; confirming the
time limit is disclosed before the timer starts.

**Pass:** all four cells exist and match; the early-termination rule actually
fires at 7; back-navigation is guarded, not silently destructive.

---

## P6 — Sign trainer & library

**Builds:** the drill mode and the browsable library with category teaching,
search/filter, per-sign mastery, and the empty-filter state.

**Judged against:** mockups `07-signs-drill`, `08-signs-library`,
`08b-signs-library-empty`, `08c-signs-library-full` · matrix cells 7 and 8 ·
`practices-checklist.md` A8.

**Critic perceives by:** driving each state and screenshotting; filtering to
nothing; confirming the drill screen's accessible names do **not** give away
the answer while remaining non-empty.

**Pass:** all four cells match; the full library renders the whole registry
without layout breakage; drill a11y names are shape/color only.

---

## P7 — Dashboard & onboarding

**Builds:** first-run onboarding, the storage-unavailable path, and the
dashboard in populated / empty / loading / error / offline / desktop states.

**Judged against:** mockups `01-onboarding`, `01b-onboarding-storage-error`,
`02-dashboard-populated`, `02b`–`02f` · matrix cells 1 and 2 ·
`practices-checklist.md` C3, C5.

**Critic perceives by:** first-run in a clean profile; blocking `localStorage`
to force the storage error; corrupting the persisted key to force the error
state; going offline; resizing to 1440×900.

**Pass:** all seven cells exist and match; no state is a white screen; the
empty dashboard reads as an invitation, not a failure.

---

## P8 — Progress, settings & rule reference

**Builds:** the progress surface (topic mastery, attempt history, hand-authored
SVG charts, empty and long-history states), settings/about (source disclosure,
non-affiliation, reset with confirmation, install prompt, data export), and the
rule-reference page reached from a citation.

**Judged against:** mockups `09-*`, `11-*`, `10-rule-reference` · matrix cells
9, 10, 11 · `practices-checklist.md` D7, A16, C4.

**Critic perceives by:** seeding 50+ attempts to force the long-history state;
emptying all progress; opening a citation link from an explanation and
confirming it lands on the right rule; triggering the destructive reset
confirm.

**Pass:** all cells match; charts degrade honestly with no data (no broken
axes); citations actually resolve; reset is guarded.

---

## P9 — Offline, PWA & resilience

**Builds:** service worker + manifest + icons, prompt-based updates, bounded
attempt history, schema migrations with tests, error boundary.

**Judged against:** `executable-floor.md` X16–X22 ·
`practices-checklist.md` C1–C6, F1–F6.

**Critic perceives by:** building, previewing, loading once, **disabling the
network**, hard-reloading, and completing a full study session, a full exam,
the sign library, and progress entirely offline while watching the network
panel; then writing garbage and a future `schemaVersion` into `localStorage`
and reloading; then stubbing `setItem` to throw.

**Pass:** zero outbound requests after first load; every corruption scenario
lands on a recoverable screen; Lighthouse installability passes.

---

## P10 — Practices & executable sweep

**Builds:** whatever the sweep turns up. This piece exists so the checklist is
audited by someone who built none of it.

**Judged against:** all of `practices-checklist.md` A1–F6 and
`executable-floor.md` X1–X23.

**Critic perceives by:** running `npm run verify`, `npm run audit`, `npm run
test:a11y`, `npm audit --omit=dev`, and hand-auditing each remaining checklist
item with a `file:line` citation per item.

**Pass:** every item checked or covered by an accepted deviation; every
threshold met. An item the critic cannot verify counts as a gap.
