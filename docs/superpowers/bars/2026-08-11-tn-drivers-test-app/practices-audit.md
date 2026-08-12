# P10 — Practices & executable sweep

**Auditor:** P10. Built none of this. Read-only on `src/`, `scripts/` and every
other bar document; the only repo file this piece created is this one.

**Date:** 2026-08-12  **Branch:** `content/p2-question-bank`  **Machine:** Windows 11, Node 24.18.0

**Method.** Every command in `executable-floor.md` was run and its output pasted
verbatim in §5. Every checklist item was checked independently, with a
`file:line` citation or verbatim runtime output. Items observable at runtime were
**driven in the production build** (`vite preview` on port **4399** — 5173 is
occupied by an unrelated app, and 5301/5302/5312 belong to the harness) rather
than read off the code. The Playwright MCP browser was not used; the driver
scripts live in the session scratchpad and touch nothing in the repo.

One temporary, reverted change was made to demonstrate E5: `package.json`'s
`prebuild` was pointed at `tests/fixtures/broken-content`, `npm run build` was
run (exit 1), and the file was restored — `git status --porcelain -- package.json`
is empty afterwards.

---

## 0. Contamination note — read this before trusting the timing evidence

**Another agent was working in this repo while this audit ran, and it edited
`src/`.** This is not a guess:

| file | mtime | mine? |
|---|---|---|
| `docs/…/ledger.md` (modified) | 06:55:48 | no |
| `docs/…/evidence/critic-p7p9/` (new) | during the sweep | no |
| **`src/store/settings.ts` (modified, +18/−1)** | **07:30:25** | **no** |
| **`tests/pwa/storage-blocked.spec.ts` (new)** | **07:31:34** | **no** |

My second `npm run verify` was executing its e2e suite from roughly 07:28 to
07:31 — i.e. **`src/store/settings.ts` changed underneath it**, and two of that
run's nine failures were in `tests/e2e/settings.spec.ts`. `test:e2e` serves the
`mobile`/`desktop` projects from a live `vite` dev server on 5301, so a
mid-flight source edit reaches the browser. The machine was also carrying ~40
`chrome` and ~35 `node` processes from that other work, two of them with 30 000+
and 26 000+ CPU-seconds.

**What this does and does not invalidate:**

- **Unaffected:** everything measured from a *built* `dist/` I produced and then
  served myself on port 4399 (all the A/B/C/F runtime rows, X16–X22), every
  content check (D, read from committed files), every static check (E1, E4, B1,
  B3, B5, B6), and the single-shot commands whose output is pasted in §5.
- **Affected:** the two `npm run verify` runs in §5.18, and only those. Their
  failures are timing artefacts of an environment I did not control, and I have
  **not** counted them against any X threshold.

The honest bottom line: **`npm run verify` has not been observed green on this
machine, and I cannot prove it would be on a quiet one.** X1–X8, X7b and X15
each pass individually, which is what the table records. Somebody should run
`verify` once on an idle checkout and paste the result into `ledger.md`.

---

## 1. Summary count

| Verdict | Checklist (A–F, 62 items) | Executable floor (24 thresholds) | Total |
|---|---|---|---|
| **PASS** | 62 | 22 | **84** |
| **FAIL** | 0 | 2 | **2** |
| **UNVERIFIED** | 0 | 0 | **0** |
| *of which covered by a ratified deviation* | 0 | 2 (X10, X23) | **2** |

Both failures are the two thresholds already filed in `deviations.md`
(2026-08-12, P9 §1 and §4). Both reproduce. **Neither was re-reported as new** —
but the filed *numbers* no longer reproduce, and that is a finding of its own
(F-1 below).

Six checklist items pass on their intent while departing from the literal
wording, or pass with an observation attached. They are listed as **notes**, not
gaps: A2, A8, A16, A17, C6, E3. Each note is stated in the table.

**One thing the count does not capture, and it is the most actionable finding
here.** `npm run verify` — the floor's own "single command that answers *does
this meet the executable floor?*" — **went red on both of my runs**, with a
different set of failures each time and every one a 30-second timeout inside
`test:e2e`. Standalone, that suite passes 299/299 in 55 seconds. The stages that
X1–X8/X7b/X15 name each pass on their own, which is why the table above reads as
it does. **I cannot attribute those failures to the app** — a concurrent agent
was editing `src/store/settings.ts` and loading the machine while they ran (§0)
— but I also cannot report the floor's headline command as green, because I
never saw it green. That is **F-2**, ranked first among the non-deviation
findings, and its close-out step is a single clean run on a quiet checkout.

---

## 2. The full table

### A. Accessibility — WCAG 2.2 AA

| id | item | verdict | how I checked | evidence |
|---|---|---|---|---|
| A1 | Text ≥4.5:1 (≥3:1 large) | **PASS** | axe across 122 state-matrix cells at `wcag2a/2aa/21aa/22aa`, Lighthouse a11y = 100, **plus** my own relative-luminance measurement of every text node on the richest screen (`/study/session?q=int-016`, answer revealed) | 18 nodes measured, **0 failures**; lowest was `.cite__src` at 4.61:1 (needs 4.5); `.verdict--bad` 5.97–7.58:1, `.verdict--ok` 9.00:1, `.stem` 16.38:1. Full list in §5.15 |
| A2 | UI components / meaningful graphics ≥3:1 | **PASS** *(note)* | measured rail fill vs track, focus ring, button border, on `/progress` with a seeded record | `.rail` fill vs track **3.74 / 4.61 / 12.40**; focus ring **10.92:1** vs the control, **11.98:1** vs the page; `.btn` border **4.45:1**. Rails are `aria-hidden="true"` with the figures stated in text — `src/components/meters.tsx:76-79`. **Note:** `.panel` surface measures 1.10:1 and its border 1.16–1.35:1 against the page. That is a grouping surface, not a component boundary, and axe/1.4.11 does not flag it — recorded so nobody re-derives it |
| A3 | Colour never the sole carrier | **PASS** | answered a study question in the production build and read the DOM | correct row = `class="choice choice--correct"` + **1 `<svg>` icon** + `aria-pressed="true"`; the verdict line reads `Your answer · incorrect` (`.verdict verdict--bad`, with an svg). Meaning survives greyscale on three independent carriers |
| A4 | Everything keyboard-reachable, logical order | **PASS** | tabbed the study session and answered with the keyboard only | tab trail `BUTTON.exit > BUTTON.choice ×3 > SUMMARY > …`; pressing `a` answered the question (verdict + citation appeared). Also `tests/e2e/study.spec.ts:111` "a whole question can be completed with the keyboard alone (practices A4)" |
| A5 | No keyboard trap; focus never lost after a state change | **PASS** | tabbed 25 times on the session; opened and closed the exam-exit dialog | focus never reached `<body>` during the session pass; after answering, focus is on a `BUTTON`; after `Escape` on the dialog, focus is restored to `BUTTON.exit` (the control that opened it) — `src/components/Dialog.tsx:36-49` |
| A6 | Focus indicator visible, ≥3:1, never removed without replacement | **PASS** | `grep -rn "outline:\s*none\|outline:\s*0" src/` → **no matches**; measured the ring under real keyboard focus | `3px solid rgb(255, 204, 0) offset 2px`; **10.92:1** against the control, **11.98:1** against the page |
| A7 | Targets ≥24×24; answer choices ≥44px tall | **PASS** | measured every `a[href]`, `button`, `[role=button]`, `input`, `select`, `summary`, `[role=switch]`, `[role=radio]` on the study session | targets under 24px: **`[]`**; min `.choice` height **75px** |
| A8 | Sign SVGs named shape + colour + meaning; drill names withhold the meaning | **PASS** *(note)* | read the a11y names off the running library, the sign detail dialog and the drill | drill stage: `aria-label="Shield, white"` — shape + colour, **no meaning**, exactly as required (`src/signs/registry.ts:143-145`), and gated twice over: `tests/e2e/sign-trainer.spec.ts:121` "names the sign by shape and colour only — never by its meaning" plus the `drill-name-leaks-meaning` fixtures in `audit:signs`. **Note:** the library card's *inner* `<svg>` also carries only `"Octagon, red"`; the meaning arrives through the card `<button>`'s composed name — measured as `"STOP STOP Come to a complete stop before the crosswalk or stop line; … New"`. So the property A8 protects holds, but the literal wording ("every sign SVG carries … meaning") does not, by design and with the reasoning stated at `src/routes/signs/parts.tsx:180-186` |
| A9 | Answer results announced via a live region, once | **PASS** | inspected the live region before and after answering | before: `[{"role":"status","live":"polite","text":""}]`; after: `text: "Incorrect. You chose A. The right answer is B."` — one node, one update |
| A10 | One `<h1>`, no skipped heading levels | **PASS** | walked `/`, `/signs`, `/progress`, `/exam`, `/settings` and read every heading level | `{"/":{"h1":1,"levels":[1,2],"skips":0},"/signs":{"h1":1,"levels":[1,2,2,2,2,2,2,2,2],"skips":0},"/progress":{"h1":1,…,"skips":0},"/exam":{"h1":1,"levels":[1],"skips":0},"/settings":{"h1":1,"levels":[1,2,2,3,2,3,3,3,3,3,3,2,2,3,2],"skips":0}}` |
| A11 | Form controls programmatically labelled | **PASS** | enumerated every `input`/`select`/`textarea` on `/settings`, `/signs`, `/study` | settings: 3 radios + 1 checkbox, all `wrapping label`; signs: `search` via `label[for]`; study: none. Zero unlabelled |
| A12 | Reflow at 320px and 200% zoom, no 2-D scrolling | **PASS** | loaded 6 routes at 320px and 4 at 200% root font size, comparing `scrollWidth` to `clientWidth` | 320px: every route `scrollW 320 / clientW 320`; 200%: every route `scrollW 640 / clientW 640`. Zero horizontal overflow |
| A13 | `prefers-reduced-motion: reduce` kills non-essential motion | **PASS** | Chromium context with `reducedMotion: 'reduce'`, then walked every element's computed `transitionDuration`/`animationDuration` | `{"count":0,"sample":[],"matches":true}` — **not one** element animates above 20ms |
| A14 | Unique descriptive `<title>` per route; `<html lang="en">` | **PASS** | navigated 10 URLs and read `document.title` | `lang="en"`; 9 unique titles across 10 URLs — `/` and `/study` share `Study · TN Drive` because they are the **same route** (`src/app/routes.tsx:23` `{ index: true, element: <StudyRoute /> }`), not two pages. Titles: `Sign library · TN Drive`, `Mock exam · TN Drive`, `Progress · TN Drive`, `Settings · TN Drive`, `Railroad stop distance · rule reference · TN Drive`, `Study session · TN Drive`, `Exam in progress · TN Drive`, `Sign drill · TN Drive` |
| A15 | The 60-minute limit is disclosed before the clock starts | **PASS** | loaded `/exam/run` and read the briefing before pressing Start | briefing controls are `Leave \| Start the exam`; the disclosure line reads verbatim **"60 minutes, on the clock. It keeps running if you leave."** — shown *before* Start |
| A16 | Native `<dialog>`, focus trapped, restored, Escape closes | **PASS** *(note)* | opened the exam-exit confirmation, tabbed 10 times, pressed Escape | on open: `{"tag":"DIALOG","open":true,"modal":true,"labelledby":"_r_1_","focusInside":true}`; after Escape: `{"open":false,"active":"BUTTON.exit"}` — restored to the opener. **Note:** the tab trail is `BUTTON [inside], BODY [OUTSIDE], BUTTON [inside], BUTTON [inside], BODY [OUTSIDE]…` — Chromium parks focus on `<body>` at the cycle boundary of a native modal. No background control ever received focus, so the trap holds; this is user-agent behaviour of `<dialog>`, not app code |
| A17 | Nothing relies on hover alone | **PASS** *(note)* | swept the app for `[title]` and for hover-revealed content | one hit in the whole product: `src/components/AppBar.tsx:19` — `title="Everything works without a connection"` on the offline badge, a **non-focusable `<span>`**. It elaborates the visible text "Offline ready"; no information or function is hover-only. Recorded as a low-severity blemish (F-8) |

### B. Security & privacy

| id | item | verdict | how I checked | evidence |
|---|---|---|---|---|
| B1 | No secrets/keys/tokens in the bundle | **PASS** | `grep -roE "(api[_-]?key\|secret\|token\|password\|bearer\|AIza…\|sk-…\|ghp_…\|-----BEGIN)" dist/ -i` | 10 hits, **all benign**: React's input-type table (`password:!0`), the onboarding copy "No email, no password, no sign-in", `"Unexpected token g in JSON"` in an error-state demo, and the design-gallery section id `"tokens"`. No key material, no `.env` reference |
| B2 | Zero network requests after first load | **PASS** | drove a full session (onboarding → study → signs → progress → exam) in `dist/` under `vite preview`, logging every `request` event | 9 requests on first load, 38 across the whole session, **0 non-origin** — and **0 non-origin after the first load boundary**. Verbatim in §5.15 |
| B3 | No third-party scripts | **PASS** | read every `<script>`/`<link>` in the built HTML; swept `dist/` for origins | `dist/index.html:37` is the only script (`/assets/index-*.js`, same origin). Origins found anywhere in `dist/`: `w3.org` (SVG namespace), `react.dev`/`reactrouter.com`/`github.com` (library error-message strings), `capitol.tn.gov`/`tn.gov`/`tsa.gov` (correction **sourceUrl** data, rendered as citations, never fetched), `localhost` (react-router's internal default). Nothing is loaded |
| B4 | No PII stored | **PASS** | read `localStorage` after a real session | `tn-drive:progress` holds `{schemaVersion, cards{questionId,topic,box,streak,lapses,seen,correct,dueAt,lastSeenAt}, topics, attempts[{questionId,topic,area,chosenIndex,correct,at}], sessionsCompleted}`; `tn-drive:setup` holds `{goal,testDate,completedAt}`. No name, email, device id or free text |
| B5 | Restrictive CSP, no `unsafe-eval`, `default-src 'self'`, documented | **PASS** | read the built page, not the config | `dist/index.html:4` — `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'`. **No `unsafe-eval`.** The app runs under it — the whole session above produced zero CSP violations in the console. Documented, with the `style-src` and `frame-ancestors` reasoning, at `vite.config.ts:8-34` |
| B6 | No `dangerouslySetInnerHTML` with non-constant input | **PASS** | `grep -rn "dangerouslySetInnerHTML" src/ index.html` | **no matches anywhere** |
| B7 | No known high/critical advisories | **PASS** | `npm audit --omit=dev` | `found 0 vulnerabilities`, exit 0 |

### C. Data integrity & resilience

| id | item | verdict | how I checked | evidence |
|---|---|---|---|---|
| C1 | Integer `schemaVersion` on persisted state | **PASS** | read the live payload | `{"state":{"schemaVersion":1,…},"version":1}` — the envelope and the state both carry it; `src/domain/progress.ts:23` `CURRENT_SCHEMA_VERSION = 1` |
| C2 | Migration path unit-tested for every prior version | **PASS** | read `migrateProgress` and its tests | `src/domain/persistence.ts:160-166` — v0→v1 via `migrateV0toV1`, anything else throws; `src/domain/persistence.test.ts:98-189` covers the migration, the `migrated` status, the `fromVersion` report, garbage input, an idempotent same-version call and `migrateProgress(state, 99)` throwing. Schema 1 is current, so v0 is the only prior version |
| C3 | Corrupt / future state degrades to a recoverable screen | **PASS** | wrote `{"garbage":true` and a `version: 9999` payload into `tn-drive:progress` and loaded `/study` in the production build | corrupt → `<h1>Your saved progress can't be read</h1>` + "Reload and try reading it again" / "Export a diagnostic file" / a gated "Reset saved progress"; the bytes were **still byte-identical** afterwards; a reload lands on the same screen (no boot loop); **0 console messages**. Future → the same screen, naming `schema 9999` vs `This app reads up to schema 1`. Full transcript in §5.10 |
| C4 | Attempt history bounded at ≤200 | **PASS** | seeded a valid record holding **400** attempts, loaded the app, answered one question, re-read storage | after load 400, **after one write 200** — verdict `PASS (bounded)`. Code: `src/domain/progress.ts:21,112-117` (`ATTEMPT_HISTORY_LIMIT = 200`, `boundAttempts`), tested at `src/domain/progress.test.ts:103-107` and `src/domain/persistence.test.ts:93` |
| C5 | A `localStorage` write failure becomes session-only mode | **PASS** | replaced `Storage.prototype.setItem` with a thrower before load | `<h1>This browser won't let the app save</h1>` — "Private browsing, a full storage quota, or a blocked site-data setting is stopping TN Drive from writing… Nothing is broken and nothing was lost", with "Check storage again" and "Continue in session-only mode". **0 unhandled page errors** |
| C6 | An error boundary renders the recoverable state | **PASS** *(note)* | `src/main.tsx:34` wraps the router in `AppErrorBoundary`; forced a route chunk to fail | `src/app/AppErrorBoundary.tsx:53-73` (`getDerivedStateFromError` + `componentDidCatch` → `ErrorState`), 4 unit tests in `AppErrorBoundary.test.tsx`, and `tests/pwa/resilience.spec.ts:151` "C6 — a chunk that cannot be fetched renders the recoverable state, never a blank page" passes against `dist/`. **Note:** my own probe (aborting `assets/Settings-*.js`) rendered a non-blank shell rather than a visibly distinct error card — the assertion I am relying on for the *recoverable state* is the project's own e2e case, not my probe |

### D. Content fidelity

Sampling: a fresh random sample of **20 questions**, seeded `mulberry32(20260812)`,
drawn one-per-topic across 20 of the 31 topics and all four blueprint areas.
Sampled ids: `alc-002, alc-029, alc-043, big-012, blt-008, def-007, emg-009,
fol-006, lan-018, lit-006, ngt-007, official-14, prk-002, reg-008, res-008,
row-011, spd-001, stp-014, trn-014, wrn-002`. Full per-question table in §4.

| id | item | verdict | how I checked | evidence |
|---|---|---|---|---|
| D1 | Every question cites a page + verbatim quote; a citation-less question fails the build | **PASS** | ran the validator, then pointed `prebuild` at the broken fixture and ran `npm run build` | `npm run validate:content` → `PASS — 506 questions, 87 signs, 0 failures`, exit 0. With `--content-dir tests/fixtures/broken-content`: `[citation] broken-no-citation: has no citation — every question needs a manual page and a verbatim quote`, exit 1, and **`npm run build` exited 1** through `prebuild` |
| D2 | Every quote verbatim in the extract | **PASS** | validator + my own independent normaliser over the 20-question sample | **20/20 verbatim**, each with `occ=1` (the quote is unique in the whole 562 KB extract, so there is no ambiguity about which page it came from) |
| D3 | The quote actually supports the keyed answer | **PASS** | read all 20 quotes against their stems, options and keyed answers by hand | **20/20 support the key.** One is weak — `def-007` (see F-3): the quote is *"As you scan the road, avoid a fixed stare."* while the keyed option is *"Keep your eyes moving and avoid a fixed stare"*; "Keep your eyes moving" is the **next** sentence on p.107 and is outside the cited span. The answer is still uniquely determined |
| D4 | Exactly one keyed answer, no duplicate choices | **PASS** | validator, demonstrated failing | fixture output: `[options] broken-duplicate-option: option 1 duplicates an earlier option` and `[answer] broken-answer-index: correctIndex 4 is not a valid option index` |
| D5 | Sign registry shape/colour/meaning correct | **PASS** | `npm run audit:signs` gates all 87 machine-wise; I additionally spot-checked 10 rendered entries against MUTCD | gate: `87 signs drawn, 186 legends inside their faces, 0 failures` with 17 self-check fixtures each still failing. My sample, read off the running library: `r1-1-stop` Octagon/red · `r3-5-mandatory-turn-lane` Vertical rectangle/white · `r5-1a-wrong-way` Horizontal rectangle/red · `w1-1-turn`, `w2-2-side-road`, `w6-1-divided-highway`, `w11-7-equestrian` Diamond/yellow · `d10-1-milepost` Vertical rectangle/green · `w20-4-one-lane-road-ahead` Diamond/orange · `s5-1-school-speed-limit` Vertical rectangle/**fluorescent yellow-green**. All 10 correct |
| D6 | Post-2022 corrections are **visible to the learner** | **PASS** | drove `/study/session?q=int-016` in the production build and answered | the answer screen prints, verbatim: **"In force since July 1, 2023 · Public Chapter 354 (2023) — Jabari Bailey Highway Safety Act (HB0092)"**. Also `tests/e2e/study.spec.ts:204` "a post-2022 correction is disclosed with its date and authority (D6/D10)" |
| D7 | Source and non-affiliation stated | **PASS** | grepped the rendered surfaces | "Not affiliated with the State of Tennessee" on the dashboard (`src/routes/dashboard/parts.tsx:362`), exam (`src/routes/exam/parts.tsx:112`, `ExamRun.tsx:390,499`), study (`StudySession.tsx:381,463`), signs (`SignsLibrary.tsx:310`, `SignsDrill.tsx:481`), progress (`progress/parts.tsx:351`), rules (`RuleReference.tsx:401`), settings (`settings/parts.tsx:362`); the long form is at `src/routes/Settings.tsx:199-200` — "not affiliated with, endorsed by, or connected to the State of Tennessee or its Department of Safety & Homeland Security" |
| D8 | 30 questions, 24 to pass, 60-minute limit, halt at 7 wrong | **PASS** | read the constants **and observed the halt** | `src/domain/exam.ts:33-36` — `EXAM_QUESTION_COUNT = 30`, `EXAM_PASS_MARK = 24`, `EXAM_WRONG_LIMIT = 7`, `EXAM_TIME_LIMIT_SECONDS = 60 * 60`. Driven: answering always-A halted the attempt after **10 answered** (7 wrong); a rotating pattern halted at 12 with the report reading `Stopped at question 12. 5 correct of 30.` `src/domain/exam.test.ts` — 53 tests |
| D9 | Blueprint honoured 25/25/25/25 from sections B and C | **PASS** | validator's own 10 simulated exams | every one of the 10 lands on 7 or 8 per area: `signs=8 safe-driving=8 rules-of-road=7 alcohol-drugs=7`, `8/7/7/8`, `7/7/8/8`, … — inside the ±1 tolerance on all 40 cells |
| D10 | Each correction carries its real effective date and public chapter, matched to `live-facts.md` | **PASS** | compared all six entries in `src/content/corrections.json` field-by-field against `docs/research/live-facts.md` | Move Over → `2023-07-01`, `Public Chapter 354 (2023) — Jabari Bailey Highway Safety Act (HB0092)` = live-facts §5.1 (l.247-249) and conflict C1 (l.460) ✅ · aggravated BAC 0.20→0.15 → `2025-07-01`, `Public Chapter 430 (2025)` = §5.4 (l.309-313) and C4 (l.463) ✅ · REAL ID → `2025-05-07` = §6.1 (l.384) and C3 (l.462) ✅ · ignition-interlock GPS → `2024-01-01`, `Public Chapter 20 (2023)` = §5.6 (l.325-330) ✅ · minimum liability → `2023-01-01`, `Tenn. Code Ann. § 55-12-102` = §5.2 (l.272-281) ✅ · early termination → verification-dated, `confidence: medium-high`, and says so in its own `note`. **The 25/50/25 trap is handled exactly as D10 demands**: `manualStates: null`, `appliesToContent: false`, and the note says "there is no manual statement to correct… never presented as a correction to text that does not exist" |
| D11 | Low-confidence facts not taught | **PASS** | grepped the bank; read the never-generate list | 5 questions touch the left lane, **none** mentions a fine or a dollar figure. `never-generate.json` entry `left-lane-fine-amounts` bans `["left[- ]most lane\|left lane\|slowpoke", "(fine\|penalty\|\\$\\d)"]`, sourced to "live-facts.md conflict C11" |
| D12 | 3 options (A/B/C) by default | **PASS** | validator | `3-option share 100.0% (floor 80%)` — all 506 questions are three-option |
| D13 | The 27 official questions ship, flagged, verbatim | **PASS** | validator + my own verbatim check of stems **and** every option text against the extract | validator: `official set 27 of 27`; ids `official-01 … official-27`, all `official: true`, all carrying a `manualAnswerPointer` (enforced at `scripts/validate-content.mjs:292-294`). My check: **27/27 stems verbatim in the extract, and 0 of the 81 option texts absent** |
| D14 | Sections B and C only | **PASS** | counted `section` across the bank; validator enforces | `{ B: 419, C: 87 }` — **no Section A**. Fixture proves the gate: `[section] broken-section-a: source section is "A" — the exam pool is sections B and C only` |
| D15 | A never-generate list exists and is enforced | **PASS** | read `src/content/never-generate.json`; ran the fixture | all six the bar names are present: `move-over-lane-threshold` (R270/R271, pp.69 vs 86), `license-renewal-cycle` (5-yr vs 8-yr), `temporary-driver-license-fees` (TDL arithmetic), `gdl-fee-figures` (Tables 2.4 vs 3.2), `back-seat-belt-age-17` (p.45 gap), `bicyclists-may-disregard-signals` (p.120 vs p.119) — plus 8 more. Enforcement demonstrated: `[never-generate] broken-banned-rule: cites rule R270, banned by "move-over-lane-threshold"` **and** `matches banned pattern [move over + (four or more lanes|two or more lanes|multi-?lane)]` |
| D16 | Citations record both PDF and printed page, `printed = pdf − 14` | **PASS** | checked all 20 sampled citations arithmetically **and** independently corroborated the folio in the extracted page text | 20/20 satisfy `printed = pdf − 14`; 19/20 also carry the printed folio as their own line in the page's text layer, and the 20th (`lit-006`, pdf 59) opens with the doubled folio `"4545"`, which corroborates printed 45. Validator enforces it: `[citation] broken-printed-page: citation 0 printedPage 67 should be 53 (printed = pdf - 14 for pp.15-132)` |
| D17 | Caption-only sign meanings are sourced and cited, never invented | **PASS** | read `meaningSource` on the four the bar names | 22 of 87 entries carry `meaningSource`. `w11-4-cattle` → `MUTCD 2009 Ed. §2C.50 ¶01`, with the MUTCD sentence quoted and a note that "the earlier citation pointed at §2C.34, which is not this sign"; `w1-5-winding-road` → `§2C.07 ¶04`, MUTCD text quoted including the 600-foot tangent; `r5-2-no-trucks` → `§2B.37`; `r3-4-no-u-turn` → `§2B.19`. None invented |
| D18 | Sample question 7 is paired with rendered artwork or excluded | **PASS** | read `official-07` | stem `"The sign at the right means:"`, `signs: ["r1-2-yield"]`, plus an `artworkNote` recording that the manual's own answer pointer sends the reader to printed p.36 where the only sign matching answer A is YIELD, and that the app renders its own face rather than guessing at unseen artwork |

### E. Stack idioms & code quality

| id | item | verdict | how I checked | evidence |
|---|---|---|---|---|
| E1 | `strict: true`, no `any`, no unexplained `@ts-ignore` | **PASS** | read `tsconfig.json`; grepped | `tsconfig.json:11-20` — `strict`, **plus** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. `grep -rnE ":\s*any\b\|<any>\|as any\|any\[\]"` over `src/**/*.ts{,x}` → **one hit, and it is prose** (`src/routes/progress/charts.tsx:345`, the chart's `<desc>` string "No lane has **any** accuracy recorded yet"). `grep -rn "@ts-ignore\|@ts-expect-error\|@ts-nocheck" src/ scripts/ tests/` → **no matches** |
| E2 | `npm run build` produces zero TS and zero lint errors | **PASS** | ran both | `npm run typecheck` exit 0; `npm run lint` (`eslint . --max-warnings 0`) exit 0; `npm run build` exit 0. Two rollup *warnings* remain and are named in F-6/F-9 |
| E3 | No `useEffect` for derived state | **PASS** *(note)* | read **all 19** effects in `src/` | every one syncs an external system or subscribes: `usePageTitle.ts:9` (document.title), `Dialog.tsx:25,36` (`showModal`/`close`, the `close` listener), `dashboard/support.ts:58,117,178` (async content pack, `online`/`offline`, `beforeinstallprompt`), `ExamReview.tsx:45` / `RuleReference.tsx:55` / `StudySession.tsx:76` / `ExamRun.tsx:79` (async loads with a `live` guard), `ExamRun.tsx:122` (ref sync), `ExamRun.tsx:150` (the one-second clock), `ExamRun.tsx:209` / `StudySession.tsx:150` / `SignsDrill.tsx:163` (window keydown), `StudySession.tsx:126` / `SignsDrill.tsx:134` (focus management), `ExamReport.tsx:73` (writes the live-region text once per verdict). **Nothing derived is computed in an effect.** *Note:* `SignsDrill.tsx:122-129` resets local state when the `mode` prop changes, guarded by a `seenMode` ref. React's own guidance prefers a `key` or an in-render adjustment; it is a state **reset**, not derived state, so it is not an E3 failure — recorded for whoever touches that file |
| E4 | List keys are stable ids | **PASS** | `grep -rnE "key=\{(i\|idx\|index)\}" src/` | **no matches.** The five `key={i…}`-looking hits are `key={item}`, `key={item.questionId}`, `key={item.term}` — value keys, not indices |
| E5 | The question bank is validated at build time | **PASS** | pointed `prebuild` at the broken fixture and ran the real build | `package.json:12` `"prebuild": "node scripts/validate-content.mjs"`. With the fixture: **`BUILD_EXIT=1`**, the build never reached `tsc`. `package.json` restored; `git status --porcelain -- package.json` empty |
| E6 | Business logic outside components, unit-tested without a DOM | **PASS** | read the layout; checked the domain tests for DOM usage | 18 modules under `src/domain/` (`exam`, `exam-history`, `scheduler`, `session`, `progress`, `persistence`, `sign-drill`, `sign-progress`, `dashboard`, `charts`, `progress-report`, `rule-reference`, `mastery`, `random`, `settings`, `setup`, `update`, `diagnostics`). `grep -rln "testing-library\|document\.\|window\." src/domain/*.test.ts` → **no matches**. Coverage 99.65% lines / 94.01% branches |
| E7 | Routes code-split, initial bundle in budget | **PASS** | read the route table; read the build output | 9 `lazy: async () => import(...)` entries at `src/app/routes.tsx:31,35,49,57,65,73,79,85,91`. Emitted chunks: `ExamReport 1.58 KB`, `ExamReview 1.97 KB`, `ExamRun 3.53 KB`, `RuleReference 3.38 KB`, `StudySession 4.01 KB`, `SignsDrill 4.95 KB`, `Settings 6.19 KB`, `Gallery 5.97 KB` (gzip). Initial JS **157.5 KB / 180 KB** |
| E8 | No console errors or warnings in a full production session | **PASS** | drove onboarding → study → signs → progress → exam in `dist/`, capturing `console` (error+warning) and `pageerror` | **0 messages.** Repeated offline with a warm precache: **0**. Also `tests/pwa/resilience.spec.ts:117` "X22 — a full study session and a full exam, with zero console noise" |

### F. PWA & offline

| id | item | verdict | how I checked | evidence |
|---|---|---|---|---|
| F1 | Valid manifest: name, 192+512 incl. maskable, colours, standalone | **PASS** | read `dist/manifest.webmanifest`; `npm run audit` asserts installability over CDP | `display: "standalone"`, `theme_color`/`background_color` `#14161A`, `id`/`start_url`/`scope` `/`, four icons — 192 + 512 `any` **and** 192 + 512 `maskable`. `npm run audit` → `Installable PWA (passes) PASS` (Chrome's own criteria: `Page.getAppManifest`, each icon fetched and confirmed a real image) |
| F2 | The SW precaches the shell, fonts and question bank | **PASS** | parsed the generated `dist/sw.js` precache manifest | **39 entries / 1708.77 KiB**, including `index.html`, `assets/index-*.js`, `assets/index-*.css`, **`assets/questions-*.js`**, `assets/rules-*.js`, all four `fonts/*.woff2`, every icon, `manifest.webmanifest`, and all eight lazy route chunks |
| F3 | The app works fully with the network disabled | **PASS** | loaded once, waited for the worker to reach `activated` **and** the CacheStorage count to stop growing (34 entries), then `setOffline(true)` and ran a whole session | cold hard-reload booted; a study question answered; the sign library rendered 42 SVGs; a mock exam ran to a **score report** (`Stopped at question 12. 5 correct of 30.`); `/signs` `/progress` `/study` `/settings` `/rules/R225` all rendered with real `<h1>`s. **0 failed requests, 0 console messages.** *(Caveat worth knowing: cutting the network before the precache finishes lands on the recoverable "could not be drawn" screen — correct behaviour, not a blank page, but it means the offline promise begins at first-visit completion, not at first paint.)* |
| F4 | Updates are prompted, never silent | **PASS** | read the config, the registration and the prompt | `vite.config.ts:138` `registerType: 'prompt'`, `:191-192` `skipWaiting: false, clientsClaim: false`, `:139` `injectRegister: null`. In `dist/sw.js` the only `skipWaiting()` is inside `addEventListener("message", e => e.data && "SKIP_WAITING" === e.data.type && self.skipWaiting())`. `src/app/service-worker.ts:26-30` registers with `onNeedRefresh: markUpdateWaiting`; `src/app/UpdatePrompt.tsx:41-43` is the only caller of `onUpdate`, behind an "Update now" button — and `shouldOfferUpdate` suppresses the toast entirely while an exam attempt is on the device |
| F5 | Self-hosted subset woff2, `font-display: swap`, zero Google Fonts | **PASS** | grepped for the CDN; read `src/styles/fonts.css`; read the built payload | `grep -rn "fonts.googleapis.com\|fonts.gstatic.com" src/ index.html dist/ public/` → **no matches**. Four `@font-face` blocks, all `font-display: swap`, all `/fonts/*.woff2`, all `unicode-range`-subset to Latin. Files: 38.5 + 21.5 KB (Overpass, Overpass Mono) plus the two Newsreader cuts, all precached |
| F6 | Install prompt offered at a sensible moment, dismissal respected | **PASS** | dispatched a real `beforeinstallprompt` on the dashboard, then dismissed it and re-fired the event | before the event: **no install control at all** (`[]`) — the app never shows a button that cannot work. After the event: `"Add to home screenNot now"`. After pressing **Not now**: offer gone; **re-firing `beforeinstallprompt` in the same session does not bring it back**. `src/routes/dashboard/support.ts:178-183` captures and `preventDefault()`s the event |

### Executable floor

| id | threshold | verdict | how I checked | evidence |
|---|---|---|---|---|
| X1 | `npm run typecheck` exit 0, zero errors | **PASS** | ran it | `EXIT=0`, no output |
| X2 | `npm run lint` exit 0, zero warnings | **PASS** | ran it | `eslint . --max-warnings 0`, `EXIT=0`, no output |
| X3 | `npm run build` exit 0 | **PASS** | ran it | `✓ built in 1.77s`, `precache 39 entries (1708.77 KiB)`, `EXIT=0`. Two non-fatal rollup warnings (F-9) |
| X4 | `npm test` all pass, none skipped | **PASS** | ran it | `Test Files 33 passed (33)` · `Tests 649 passed (649)` · zero skipped · `EXIT=0` |
| X5 | ≥90% line **and** branch on `src/domain/` | **PASS** | ran it; the threshold is enforced in config | `domain 99.65 lines / 94.01 branches / 100 funcs`. Enforced at `vite.config.ts:247-249` (`'src/domain/**': { lines: 90, branches: 90, functions: 90, statements: 90 }`), `EXIT=0` |
| X6 | `npm run test:e2e` all pass | **PASS** *(caveat: §0)* | ran it standalone, and twice more inside `npm run verify` | **Standalone: 299 passed (55.4s), `EXIT=0`** across `mobile`, `desktop` and `production`. **Inside `verify` it went red both times — 6 failures, then a different 9 — all 30-second test timeouts, at 3.1 min and 3.0 min for the same suite.** No assertion disagreed with the app's behaviour; several failing cases passed in the same run on the other project, and attempt 2 straddled another agent's edit to `src/store/settings.ts` (§0). X6 is recorded PASS on the standalone evidence; the instability is **F-2** |
| X7 | `npm run validate:content` exit 0 | **PASS** | ran it, and ran it against the broken fixture | `PASS — 506 questions, 87 signs, 0 failures`, `EXIT=0`. Fixture: **139 problems**, `EXIT=1` |
| X7b | `npm run audit:signs` exit 0 | **PASS** | ran it | `PASS — 87 signs drawn, 186 legends inside their faces, 0 failures`, `EXIT=0`; **17 self-check fixtures each still fail as designed** (palette, containment, drill-name leak, MUTCD-missing, question-contradiction, …) |
| X8 | initial JS ≤180 KB gzip, excl. the bank | **PASS** | ran `npm run size` | `initial JS (gzip, excl. question bank) 157.5 KB / 180.0 KB` |
| X9 | total precached payload ≤2.5 MB | **PASS** | same run | `total precached payload (raw) 1726.2 KB / 2560.0 KB` |
| X10 | Lighthouse Performance ≥90 | **FAIL — covered by deviation** | ran `npm run audit` **twice** | **88** both times (simulated throttling), `npm run audit` exits non-zero. See F-1: the filed number is **89**, and the deviation's "real throttling 90–91" reads **85** and **87** here |
| X11 | Lighthouse Accessibility = 100 | **PASS** | same | `Accessibility 100 (= 100) PASS`, both passes, both runs |
| X12 | Lighthouse Best Practices ≥95 | **PASS** | same | `Best Practices 100` |
| X13 | Lighthouse SEO ≥90 | **PASS** | same | `SEO 100` |
| X14 | Installable PWA | **PASS** | same — asserted against Chrome's criteria over CDP, since Lighthouse 13 removed the audit | `Installable PWA (passes) PASS` |
| X15 | axe across every route and state-matrix cell, zero violations | **PASS** | ran `npm run test:a11y` | **122 passed (25.6s)**, `EXIT=0` — two viewports (390 and 1440) across dashboard, onboarding, study, exam (briefing, run, halted, report, review), signs (library, empty, drill), progress (empty, populated, 50+ sittings, filtered), rules, settings (incl. the destructive confirmation and the refused erase), plus the error and offline cells |
| X16 | Boots offline after a hard reload | **PASS** | drove it by hand against `dist/` on 4399 | booted, `1289` chars rendered; also `tests/pwa/offline.spec.ts:19,39` (root **and** a deep link into a focus mode) |
| X17 | Offline: study question, full exam, sign library, progress | **PASS** | drove all four by hand with a warmed precache | study answered · sign library 42 SVGs · progress rendered · exam ran to a score report · `/settings` and `/rules/R225` too. **0 failed requests** |
| X18 | Zero outbound requests after first load | **PASS** | logged every request across a full session | 0 non-origin, first load or after |
| X19 | Garbage in the persisted key → recoverable screen | **PASS** | wrote `{"garbage":true` and loaded `/study` | `<h1>Your saved progress can't be read</h1>`, three offered actions, bytes untouched, no boot loop, 0 console messages |
| X20 | Far-future `schemaVersion` → recoverable screen offering a reset | **PASS** | wrote `version: 9999` | same screen, naming `schema 9999` vs `This app reads up to schema 1`; the gated reset works and lands on the dashboard |
| X21 | `setItem` throws → session-only mode, no unhandled rejection | **PASS** | replaced `Storage.prototype.setItem` with a thrower | `<h1>This browser won't let the app save</h1>` + "Continue in session-only mode"; **0 unhandled page errors** |
| X22 | Zero console errors/warnings in a full production session | **PASS** | drove it, online and offline | 0 and 0 |
| X23 | First question interactive ≤2.5 s on Slow-4G + 4× CPU | **FAIL — covered by deviation** | ran `npm run audit:startup` | `X23 first question interactive (Lighthouse Slow 4G): **2530 ms** — OVER the X23 budget of 2500 ms`; DevTools Slow 4G **4491 ms**; the dashboard entry point **2183 ms — within**; warm from the precache **475 ms — within** |

**Required npm scripts.** All thirteen the floor names are present and all were
run: `dev · build · preview · typecheck · lint · test · test:coverage ·
test:e2e · test:a11y · validate:content · size · audit · verify`
(`package.json:11-30`). `npm run verify` chains X1–X8, X7b and X15 exactly as
the floor requires.

---

## 3. Ranked findings

Ranked by what a reader should act on first. Nothing here blocks the two known
deviations from standing. **F-2 is ranked first** — a gate that will not answer
the same way twice undermines every other row in this document. F-1 is an
accuracy problem in a filing, not a product problem, but it touches a ratified
document and so has to be corrected by hand.

| # | severity | finding | what it takes to close |
|---|---|---|---|
| **F-2** | **high — but see the contamination note** | **`npm run verify` failed both times I ran it** — 6 failures, then a *different* 9 — always and only inside `test:e2e`, and every one a 30-second test timeout rather than an assertion disagreeing with the app. Standalone, `npm run test:e2e` passes **299/299 in 55.4 s**; inside `verify` the same suite took **3.1 min / 3.0 min**, and in attempt 1 several failing cases passed *in the same run on the other project*. **I could not isolate the cause, and I am not claiming the app is at fault** — see the contamination note in §0. What I can state as defects rather than symptoms: (a) `playwright.config.ts:55-56` starts `vite preview` on **5302** while `playwright.a11y.config.ts:21-22` starts `vite` on **5302** as well, both `--strictPort`, both `reuseExistingServer: false` — they cannot coexist, and a leaked server from either kills the other, which is exactly how my first `test:e2e` and `test:a11y` both died on `http://localhost:5302 is already used`; (b) `playwright.config.ts:22-24` sets `fullyParallel: true` with no `workers` cap and `retries: process.env.CI ? 1 : 0`, i.e. **zero retries locally**, so the one environment a human actually runs the floor in is the one with no tolerance at all | (a) Give the a11y harness its own port — 5303 is free — one line in `playwright.a11y.config.ts`. `--strictPort` is right and should stay. (b) `retries: 1` unconditionally rather than CI-only, and/or cap `workers` (4 is ample for 299 tests that run in 2–3 s each on an idle machine). (c) Then **re-run `npm run verify` on a quiet checkout with no other agent touching `src/`** and record the result — that, not this row, is the answer to "is the gate reliable?". **Do not close this by re-running until it happens to be green** |
| **F-1** | **high (accuracy of a filed deviation)** | `deviations.md` (2026-08-12, P9 §4) records Lighthouse Performance **89** under simulated throttling and **90–91** under real (DevTools) throttling, and reproduces that as a verbatim block. Two independent runs on this machine give **88** simulated and **85 / 87** real. CLS also moved from the filed `0` to `0.002`. The gap is therefore **wider than filed and the "real throttling reaches 90" consolation does not hold**. The direction and the reasoning of the deviation are still honest; the numbers are not current | Re-run `npm run audit` two or three times, replace the pasted block in the deviation with the current spread (state it as a range, since it is a wall-clock benchmark), and drop or re-qualify the "90–91 under real throttling" sentence. No code change needed — but note the ceiling analysis in the deviation is unchanged: closing it needs the entry chunk to shrink or SSR, and SSR is forbidden by grounding §1 |
| **F-3** | **medium (content)** | `def-007`'s citation under-covers the option it keys. Quote: *"As you scan the road, avoid a fixed stare."* Keyed option: *"Keep your eyes moving and avoid a fixed stare."* The first clause is the **next** sentence on PDF p.107 and is outside the cited span. The answer is still uniquely determined (the distractor "fix your eyes on the vehicle ahead" is directly contradicted), so this is a citation-coverage defect, not a wrong answer. `official-14` has the same shape in miniature — "when the way is clear" comes from the sentence after the quote | Extend `def-007`'s quote to *"As you scan the road, avoid a fixed stare. Keep your eyes moving and learn to read the road."* — still wholly on p.107, so the page-exactness gate is unaffected. Same for `official-14`. Owner: whoever owns `src/content/authoring/` |
| **F-4** | **medium (product reach, measured across the whole bank)** | The sample flagged 2 of 20 citations with **no `ruleId`**; measuring the whole bank, it is **137 of 543 citations (25.2%)** and **111 of 506 questions (21.9%) have no `ruleId` on *any* citation**. `src/components/ExplanationBlock.tsx:53,81-85` derives the rule-reference link as `citation.to ?? (citation.ruleId ? ruleHref(citation.ruleId) : undefined)` and renders `CitationLink` **only when that resolves** — so on those 111 questions the learner gets the quote and both page numbers but **no in-app route to the rule**. D1/D2/D16 are unaffected (the citation itself is complete); what is lost is P8's "turn a footnote into a destination". Worst-hit topics: `warning-signs` 11, `defensive-driving` 10, `guide-and-service-signs` 8, `dui-penalties` 7, `night-driving` 7, `regulatory-signs` 7 | Decide whether this is intended. P2's deviation explains *some* of it — 15 spine rules were dropped for PDF hyphenation and "those rules are simply not cited … or by an inline quote that does match" — but 15 dropped rules cannot account for 137 citations. If it is intended, say so in `deviations.md` with the real percentage. If not, back-fill `ruleId` where a matching rule exists and add a validator warning that reports the uncovered share, so it cannot drift further |
| **F-5** | **medium (validation coverage)** | **Nothing validates the `explanation` field.** The validator checks the quote, the page pair, the single key, duplicate options, the topic, the section, the sign references, the never-generate list and the citation-support heuristic — but **no check ties `explanation` to its citation**. To be precise about what *is* covered: `scripts/validate-content.mjs:125-152` **does** include `question.explanation` in the never-generate haystack, so a banned phrase or pattern in an explanation fails the build. What is not covered is everything else — an explanation may state a number, a distance, a penalty or a rule that appears in no citation on that question and nothing objects. It is the one place a fabricated fact could reach a learner with a perfectly valid citation sitting next to it. I read all 20 sampled explanations and found none wrong (I specifically re-checked `reg-008`, which a first pass had flagged: its explanation — "Red DO NOT ENTER and WRONG WAY signs are the last warnings if you miss it" — is accurate, since R6-1 is a black-and-white rectangle and R5-1/R5-1a genuinely are the downstream signs). So this is an **absent control**, not a known error | **I prototyped the cheap gate and it works.** Flagging any number in an `explanation` that appears in none of that question's citation quotes returns **11 of 506** — a reviewable list, not noise. I then checked each against the extract: `res-014`'s `$400`, `res-009`'s `$75` and `blt-014`'s "parades under 20 m.p.h." are all **true and in the manual**, just outside the quoted span (extract lines 8706, 8394, 3459-3461). One is not: **`gde-010`'s explanation says the slow-moving-vehicle emblem means "often under 25 m.p.h.", and the manual's SMV section (PDF p.54) states no speed at all** — the only "25 m.p.h." in the whole extract is a roundabout advisory and a points table. That is uncited teaching text of exactly the kind D17 forbids for signs. Implementation is a few lines beside the existing `numeric-contradiction` check in `scripts/lib/citation-support.mjs`; running `scoreCitationSupport` over the explanation as a *warning* channel is the wider version |
| **F-6** | **low (docs vs code)** | `vite.config.ts:86-87` states "**`modulepreload` and not `prefetch`**: it is needed on this navigation, not a possible next one", and the code twelve lines below emits `rel="prefetch"` (`:106`, confirmed in `dist/index.html:39`). One of the two is wrong, and the comment is load-bearing for the X23 analysis in the P9 deviation, which credits this change with removing a full round trip | Decide which is intended and make them agree. If `prefetch` is intended, the comment's own argument says it should not be — `modulepreload` is the higher priority and the bank *is* needed on this navigation |
| **F-7** | **low (letter of the bar)** | A8 says "**every** sign SVG carries an accessible name describing shape + colour + meaning — except in drill mode". In the library grid and the sign detail dialog the SVG's own `aria-label` is shape + colour only (`mode="drill"`, `src/routes/signs/parts.tsx:198,325`); the meaning reaches the user through the card `<button>`'s composed name and through adjacent text. The protected property holds; the wording does not | Either re-word A8 to speak about the *announced* name of the control rather than the SVG element, or pass `mode="labeled"` in the library and accept the duplication. The reasoning for the current choice is already written at `parts.tsx:180-186` and is sound |
| **F-8** | **low (a11y blemish)** | `src/components/AppBar.tsx:19` puts `title="Everything works without a connection"` on a **non-focusable `<span>`**. It is the only hover-only string in the product. Keyboard and touch users never see it | Drop the `title` (the visible "Offline ready" already says it), or move the sentence into visible/`sr-only` text |
| **F-9** | **low (build noise)** | Two warnings survive every build: (a) `Some chunks are larger than 500 kB after minification` for the 526 KB entry chunk, and (b) the rollup consistency warning that `src/content/index.ts` is both dynamically and statically imported. P8 deviation §11 names the one-line fix for (b) — add `with { type: 'json' }` to the static imports in `src/content/index.ts` — and it has not been applied | Apply the one-liner for (b). For (a), either raise `build.chunkSizeWarningLimit` deliberately (the real budget is X8 and it passes at 157.5/180 KB gzip) or leave it and record that the gate is X8, not rollup's default |
| **F-10** | **informational** | Stale dev servers from earlier sessions were still listening when this audit started (a `node` on 4173 from 01:59, and something on 5302). They are what caused F-2 to fire. `npm run audit` also leaves `lighthouse-report.{json,html}` in the repo root — correctly gitignored | Housekeeping only. Worth a line in whatever runs the gauntlet: kill 4173/5301/5302/5312 between pieces |

---

## 4. The 20-question content sample (D2 / D3 / D16)

Seed `mulberry32(20260812)`; one question drawn per topic across 20 of the 31
topics, spanning all four blueprint areas. Every quote was matched with the
project's own normalisation rule (whitespace collapsed, curly quotes/apostrophes
and en/em dashes folded to ASCII, case-sensitive), located against the extract's
`===== PAGE N =====` index, and read by hand against the keyed answer.

| id | topic | pdf/printed | verbatim | page-exact | supports answer | note |
|---|---|---|---|---|---|---|
| alc-002 | alcohol-effects | 93 / 79 | PASS | PASS | PASS | quote names coffee/exercise/cold shower and closes "Only time can sober a person"; both distractors directly refuted |
| alc-029 | dui-law | 95 / 81 | PASS | PASS | PASS | the p.95 bullet is titled "IDs with 'DUI Offender:'"; the conditional matches the stem |
| alc-043 | dui-penalties | 96 / 82 | PASS | PASS | PASS | the "Please note" sentence, verbatim on the 6-month interlock figure |
| big-012 | sharing-road-large-vehicles | 125 / 111 | PASS | PASS | PASS | — |
| blt-008 | safety-belts-and-restraints | 45 / 31 | PASS | PASS | PASS | keyed option is a near-verbatim restatement |
| def-007 | defensive-driving | 107 / 93 | PASS | PASS | **PASS (weak)** | **F-3.** Quote stops one sentence short of the keyed option's first clause. No `ruleId` (**F-4** — 111 of 506 questions share this) |
| emg-009 | emergency-handling | 111 / 97 | PASS | PASS | PASS | distractor "steer into the shoulder" refuted by "on the roadway" in the same quote |
| fol-006 | following-and-stopping-distance | 62 / 48 | PASS | PASS | PASS | — |
| lan-018 | lane-use-and-passing | 77 / 63 | PASS | PASS | PASS | keyed option enumerates the quote's list exactly; the quote preserves the PDF's `road-way` hyphenation, which is why it matches |
| lit-006 | vehicle-lighting | 59 / 45 | PASS | PASS | PASS | quote is unconditional ("illegal … by themselves") |
| ngt-007 | night-driving | 88 / 74 | PASS | PASS | PASS | 500 ft appears elsewhere as the dimming distance but not for this stem |
| official-14 | interstate-driving | 82 / 68 | PASS | PASS | PASS | "when the way is clear" comes from the next sentence; key is still unambiguous ("you do the opposite" reverses both distractors) |
| prk-002 | parking-and-backing | 78 / 64 | PASS | PASS | PASS | flat prohibition, no conditional |
| reg-008 | regulatory-signs | 51 / 37 | PASS | PASS | PASS | quote is verbatim the keyed option ("you must not enter from the direction you are traveling"). A first pass flagged the explanation as mismatched; I re-checked it and it is correct. No `ruleId` (**F-4**) |
| res-008 | driving-responsibilities | 100 / 86 | PASS | PASS | PASS | the same page's "12 months" makes distractor A a deliberate near-miss; the quote says "once in any five-year period" plainly |
| row-011 | right-of-way | 67 / 53 | PASS | PASS | PASS | — |
| spd-001 | speed-limits | 61 / 47 | PASS | PASS | PASS | stem's scope matches the quote's, so 65 (interstate) is not arguable |
| stp-014 | required-stops | 65 / 51 | PASS | PASS | **PASS (strong)** | distractor "four or more lanes" refuted two sentences later: "A turn lane in the middle of a four-lane highway is NOT considered a barrier" |
| trn-014 | turning | 73 / 59 | PASS | PASS | PASS | — |
| wrn-002 | warning-signs | 52 / 38 | PASS | PASS | PASS | the adjacent *turn* sign ("30 m.p.h. or less") makes the distractors meaningful; the quote is specific to the *curve* sign |

**20/20 verbatim · 20/20 page-exact · 20/20 support the key.** Every quote had
`occ = 1` — unique across the whole 562 KB extract, so no quote's page is
ambiguous. Every citation satisfied `printed = pdf − 14`, and 19 of 20 were
independently corroborated by the printed folio appearing in that page's own
text layer (the 20th, `lit-006`, opens with the doubled folio `4545`, which
corroborates printed 45).

### Quotes reproduced for spot-checking

- **alc-002** — "the liver can only oxidize about one drink per hour. Contrary to popular belief, this rate cannot be increased by drinking coffee, exercising, taking a cold shower or anything else. Only time can sober a person who's been drinking."
- **stp-014** — "When driving on a highway with separate roadways for traffic in opposite directions, divided by median space or a barrier not suitable for vehicular traffic, the driver need not stop, but should proceed with caution."
- **def-007** — "As you scan the road, avoid a fixed stare."  *(p.107 continues: "Keep your eyes moving and learn to read the road.")*
- **big-012** — "Farm machinery usually does not have turn signals and to make a right turn, operators of farm machinery may first pull wide to the left, then turn to the right."
- **wrn-002** — "The curve sign is used to mark curves with recommended speeds in the range between 30 and 55 m.p.h."
- **official-14** — "You must use the merging or acceleration lane to speed up and merge with fast-moving traffic already on the interstate."
- **res-008** — "the Defensive Driving Course option is only available once in any five-year period."

None of the 20 appears in `corrections.json` or `never-generate.json`, so none
is under an active override.

---

## 5. Verbatim command output

### 5.1 `npm run typecheck` — X1

```
> tn-drive@0.1.0 typecheck
> tsc --noEmit

EXIT=0
```

### 5.2 `npm run lint` — X2

```
> tn-drive@0.1.0 lint
> eslint . --max-warnings 0

EXIT=0
```

### 5.3 `npm run build` — X3 (tail)

```
dist/assets/Gallery-2a_byq33.js                   17.22 kB │ gzip:   5.97 kB
dist/assets/Settings-YAosaCUv.js                  18.81 kB │ gzip:   6.19 kB
dist/assets/rules-DMPK99dJ.js                    238.54 kB │ gzip:  49.76 kB
dist/assets/questions-DL1eHBho.js                428.49 kB │ gzip:  85.85 kB
dist/assets/index-CTGEZxs5.js                    526.02 kB │ gzip: 161.59 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.77s

PWA v1.3.0
mode      generateSW
precache  39 entries (1708.77 KiB)
files generated
  dist/sw.js
EXIT=0
```

The other warning, emitted on every build (F-9b):

```
(!) C:/Users/ehart/repos/hartye-drive/src/content/index.ts is dynamically imported by
    src/routes/dashboard/support.ts but also statically imported by
    ExamReview.tsx, ExamRun.tsx, Progress.tsx, RuleReference.tsx, Settings.tsx,
    StudySession.tsx, exam/support.ts, signs/registry.ts,
    dynamic import will not move module into another chunk.
```

### 5.4 `npm test` — X4 (tail)

```
 Test Files  33 passed (33)
      Tests  649 passed (649)
   Start at  06:55:51
   Duration  5.35s
EXIT=0
```

### 5.5 `npm run test:coverage` — X5 (`src/domain/` block)

```
 domain            |   99.65 |    94.01 |     100 |   99.65 |
  charts.ts        |     100 |     90.9 |     100 |     100 | 58,87,107
  dashboard.ts     |     100 |    94.17 |     100 |     100 | 130,160,274,377
  diagnostics.ts   |     100 |    92.68 |     100 |     100 | 59-60,73
  exam-history.ts  |     100 |       92 |     100 |     100 | ...54,267-272,331
  exam.ts          |     100 |    95.03 |     100 |     100 | ...33-234,263,378
  mastery.ts       |     100 |      100 |     100 |     100 |
  persistence.ts   |     100 |    92.66 |     100 |     100 | ...88,110,114,207
  ...ess-report.ts |     100 |    89.28 |     100 |     100 | ...49-150,204,258
  progress.ts      |     100 |      100 |     100 |     100 |
  random.ts        |     100 |      100 |     100 |     100 |
  ...-reference.ts |     100 |    98.18 |     100 |     100 | 165
  scheduler.ts     |     100 |      100 |     100 |     100 |
  session.ts       |     100 |    95.23 |     100 |     100 | ...05,194,200,202
  settings.ts      |     100 |      100 |     100 |     100 |
  setup.ts         |     100 |    93.75 |     100 |     100 | 118,175,199
  sign-drill.ts    |   98.22 |    92.23 |     100 |   98.22 | 283-286
  sign-progress.ts |   97.89 |    90.62 |     100 |   97.89 | 205-206,244,247
  update.ts        |     100 |      100 |     100 |     100 |
EXIT=0
```

### 5.6 `npm run test:e2e` — X6

First attempt (environmental, F-2):

```
Error: http://localhost:5302 is already used, make sure that nothing is running
on the port/url or set reuseExistingServer:true in config.webServer.
EXIT=1
```

After killing the stray servers:

```
  ✓  293 [production] › tests\pwa\offline.spec.ts:55:3 › offline › X17/X18 — a whole study, exam, signs and progress session, entirely offline (4.8s)
  ✓  296 [production] › tests\pwa\resilience.spec.ts:117:3 › resilience in the production build › X22 — a full study session and a full exam, with zero console noise (4.6s)

  299 passed (55.4s)
EXIT=0
```

### 5.7 `npm run validate:content` — X7

```
Tennessee Class D content validation
  content dir      C:\Users\ehart\repos\hartye-drive\src\content
  manual extract   C:\Users\ehart\repos\hartye-drive\docs\research\tn-dl-manual-extract.txt

  questions        506 (floor 300)
  official set     27 of 27
  signs            87 (floor 80)
  3-option share   100.0% (floor 80%)

  by blueprint area (floor 60 each)
    signs             100
    safe-driving      138
    rules-of-road     197
    alcohol-drugs      71

  by topic (floor 10 each)
    adverse-weather                            19
    alcohol-effects                            21
    defensive-driving                          12
    driving-responsibilities                   27
    dui-law                                    17
    dui-penalties                              19
    emergency-handling                         12
    following-and-stopping-distance            13
    guide-and-service-signs                    11
    interstate-driving                         21
    lane-use-and-passing                       24
    night-driving                              11
    parking-and-backing                        20
    pavement-markings                          13
    phones-and-distraction                     11
    railroad-crossing-signs                    11
    regulatory-signs                           12
    required-stops                             23
    right-of-way                               24
    safety-belts-and-restraints                22
    sharing-road-large-vehicles                17
    sharing-road-pedestrians-and-bicycles      17
    sign-colors-and-shapes                     12
    speed-limits                               14
    traffic-signals                            15
    turning                                    21
    underage-and-other-drugs                   14
    vehicle-lighting                           12
    vehicle-readiness                          15
    warning-signs                              15
    work-zone-signs                            11

  citations page-exact, except 0 admitted page-straddling quotes

  10 simulated 30-question exams — per-area mix (target 7-8 each)
    exam  1  signs=8  safe-driving=8  rules-of-road=7  alcohol-drugs=7
    exam  2  signs=8  safe-driving=7  rules-of-road=7  alcohol-drugs=8
    exam  3  signs=7  safe-driving=7  rules-of-road=8  alcohol-drugs=8
    exam  4  signs=7  safe-driving=8  rules-of-road=8  alcohol-drugs=7
    exam  5  signs=8  safe-driving=8  rules-of-road=7  alcohol-drugs=7
    exam  6  signs=8  safe-driving=7  rules-of-road=7  alcohol-drugs=8
    exam  7  signs=7  safe-driving=7  rules-of-road=8  alcohol-drugs=8
    exam  8  signs=7  safe-driving=8  rules-of-road=8  alcohol-drugs=7
    exam  9  signs=8  safe-driving=8  rules-of-road=7  alcohol-drugs=7
    exam 10  signs=8  safe-driving=7  rules-of-road=7  alcohol-drugs=8

PASS — 506 questions, 87 signs, 0 failures.
EXIT=0
```

### 5.8 The validator against the broken fixture — D1/D4/D14/D15/D16/E5

`node scripts/validate-content.mjs --content-dir tests/fixtures/broken-content`:

```
FAIL — 139 problems:
  [citation] broken-fabricated-quote: citation 0 quote does not appear verbatim in the manual extract: "A green light means the intersection belongs to you and you may procee..."
  [citation] broken-fabricated-quote: citation 0 quote does not appear on PDF page 55
  [citation] broken-no-citation: has no citation — every question needs a manual page and a verbatim quote
  [options] broken-duplicate-option: option 1 duplicates an earlier option
  [answer] broken-answer-index: correctIndex 4 is not a valid option index
  [support] broken-banned-rule: no-keyed-support: the quote contains none of the keyed answer's distinctive words (2, direction, moving, same)
  [never-generate] broken-banned-rule: cites rule R270, banned by "move-over-lane-threshold"
  [never-generate] broken-banned-rule: matches banned pattern [move over + (four or more lanes|two or more lanes|multi-?lane)] (move-over-lane-threshold)
  [section] broken-section-a: source section is "A" — the exam pool is sections B and C only
  [topic] broken-unknown-topic: topic "boat-trailers" is not in taxonomy.json
  [support] broken-unknown-sign: distractor-dominant: the quote matches 2 distinctive word(s) of distractor "Rocks that may strike you from overhead" but only 1 of the keyed answer
  [signs] broken-unknown-sign: references sign "w8-99-imaginary-sign", which is not in the sign registry
  [citation] broken-printed-page: citation 0 printedPage 67 should be 53 (printed = pdf - 14 for pp.15-132)
  [ids] broken-printed-page: duplicate question id
  [support] broken-key-quote-contradiction: no-keyed-support: the quote contains none of the keyed answer's distinctive words (behind, painted)
  [support] broken-numeric-key: numeric-contradiction: the keyed answer says 4 but the quote contains 8 — a distractor's number — and not the keyed one
  [support] broken-distractor-dominant: distractor-dominant: the quote matches 2 distinctive word(s) of distractor "Uninsured motorist insurance" but only 0 of the keyed answer
  [citation] broken-off-by-one-page: citation 0 quote does not appear on PDF page 126
  [official] set: expected 27 official sample questions flagged official:true, found 0
  ... and 79 more
EXIT=1
```

And with `prebuild` temporarily pointed at that fixture:

```
$ npm run build
  ... (the same 139 problems) ...
BUILD_EXIT=1
```

`package.json` restored immediately afterwards; `git status --porcelain -- package.json`
returns nothing and `"prebuild": "node scripts/validate-content.mjs"` is back.

### 5.9 `npm run audit:signs` — X7b

```
audit:signs — MUTCD sign registry gate (executable-floor.md 3b)

  registry entries                 87
  hand-authored faces              87 (floor 80)
  legend nodes measured in browser 186 (93 at 220px, 93 at 36px)
  face points sampled for colour   39222
  palette tokens                   red, white, black, yellow, orange, green, blue, fluorescent-yellow-green
  contact sheet                    pass --sheet to write it

  self-check — every assertion still fails on its fixture
    OK    clean input, no failures     clean.json
    OK    color-declared-not-painted   color-declared-not-painted.json
    OK    color-painted-not-declared   color-painted-not-declared.json
    OK    drill-name-leaks-meaning     drill-name-leaks-meaning--legend.json
    OK    drill-name-leaks-meaning     drill-name-leaks-meaning.json
    OK    face-color-mismatch          face-color-mismatch.json
    OK    geometry-missing             geometry-missing.json
    OK    legend-color-mismatch        legend-color-mismatch.json
    OK    legend-overflow              legend-overflow.json
    OK    mutcd-missing                mutcd-missing.json
    OK    name-incomplete              name-incomplete.json
    OK    palette-dead-token           palette-dead-token.json
    OK    palette-unknown-token        palette-unknown-token.json
    OK    question-contradiction       question-contradiction.json
    OK    shape-mismatch               shape-mismatch--unpainted-outline.json
    OK    shape-mismatch               shape-mismatch.json
    OK    sign-floor                   sign-floor.json

PASS — 87 signs drawn, 186 legends inside their faces, 0 failures.
EXIT=0
```

### 5.10 `npm run size` — X8 / X9 (tail)

```
--- budget ---
  initial JS (gzip, excl. question bank)  157.5 KB / 180.0 KB
  total precached payload (raw)           1726.2 KB / 2560.0 KB

PASS — within the offline weight budget.
EXIT=0
```

### 5.11 `npm audit --omit=dev` — B7

```
found 0 vulnerabilities
EXIT=0
```

### 5.12 `npm run audit` — X10–X14 (two runs)

Run 1:

```
  Lighthouse 13.4.1 — category scores (simulated throttling)

    Performance       88   (>= 90)  FAIL
    Accessibility    100   (= 100)  PASS
    Best Practices   100   (>= 95)  PASS
    SEO              100   (>= 90)  PASS

  key metrics

    first-contentful-paint     1.7 s
    largest-contentful-paint   3.7 s
    total-blocking-time        0 ms
    cumulative-layout-shift    0.002
    speed-index                1.7 s

  category scores (real throttling) — reported, not gated

    Performance       85
    Accessibility    100
    Best Practices   100
    SEO              100
    first-contentful-paint     1.5 s
    largest-contentful-paint   3.1 s

  installability (Chrome criteria, over CDP)

    Installable PWA        (passes)      PASS

FAIL
  Performance 88 misses >= 90
EXIT=1
```

Run 2 (same build, clean ports):

```
    Performance       88   (>= 90)  FAIL
    Accessibility    100   (= 100)  PASS
    Best Practices   100   (>= 95)  PASS
    SEO              100   (>= 90)  PASS
    cumulative-layout-shift    0.002

  category scores (real throttling) — reported, not gated
    Performance       87

  installability (Chrome criteria, over CDP)
    Installable PWA        (passes)      PASS

FAIL
  Performance 88 misses >= 90
EXIT=1
```

Compare with the block filed in `deviations.md` (P9 §4): **Performance 89**,
CLS **0**, real throttling **90 (90–91 across runs)**. See F-1.

### 5.13 `npm run test:a11y` — X15

```
  ✓  120 [desktop-1440] › tests\a11y\axe.spec.ts:528:1 › axe: settings — cell 11, with the reading preference turned up (1.7s)
  ✓  121 [desktop-1440] › tests\a11y\axe.spec.ts:539:1 › axe: settings — cell 11b, the destructive confirmation (1.9s)
  ✓  122 [desktop-1440] › tests\a11y\axe.spec.ts:554:1 › axe: settings — cell 11c, the erase the browser refused (1.5s)

  122 passed (25.6s)
EXIT=0
```

(First attempt also died on the 5302 collision — F-2.)

### 5.14 `npm run audit:startup` — X23

```
Running 4 tests using 1 worker

  X23 first question interactive (Lighthouse Slow 4G): 2530 ms — OVER the X23 budget of 2500 ms
  ✓  1 tests\startup\startup.spec.ts:93:3 › startup › X23 — first question interactive within 2.5 s, cold, on Slow 4G + 4× CPU (2.9s)

  X23 first question interactive (DevTools Slow 4G, 562 ms RTT): 4491 ms — OVER the X23 budget of 2500 ms
  ✓  2 tests\startup\startup.spec.ts:109:3 › startup › X23 — the same load on the harsher DevTools "Slow 4G" preset, measured (4.7s)

  X23 first screen interactive (Lighthouse Slow 4G): 2183 ms — within the X23 budget of 2500 ms
  ✓  3 tests\startup\startup.spec.ts:123:3 › startup › X23 — the dashboard, the other cold entry point (2.3s)

  warm first question interactive (DevTools Slow 4G): 475 ms — within the X23 budget of 2500 ms
  ✓  4 tests\startup\startup.spec.ts:141:3 › startup › the visit that actually happens in the parking lot — warm, from the precache (1.1s)

  4 passed (13.0s)
EXIT=0
```

The spec exits 0 because it asserts only a loose regression tripwire and prints
an explicit verdict — which is exactly what the P9 deviation says it does. The
budget is missed and is not softened. `2530 ms` sits inside the filed
`2 220 – 2 856 ms` range.

### 5.15 The production-build session driver — B2/E8/X18/X22

```
########## 1. full session in the production build — console + network
  first screen heading sample: STOP | TN Drive |  | TENNESSEE · CLASS D
  study stem: To gain more control of your vehicle in a strong wind you should:
  requests during first load: 9
  non-origin requests (whole session): 0 []
  requests after first load (count): 38
  ... of which non-origin: 0
  console errors/warnings: 0
  [PASS] B2/X18 — 0 non-origin requests after first load
  [PASS] E8/X22 — 0 console errors/warnings across a full session
```

Measured text contrast on `/study/session?q=int-016` with the answer revealed
(WCAG 2.x relative luminance, background resolved by walking up to the first
opaque ancestor):

```
  ok     8.24:1 (need 4.5) 13px  .num dim text-[0.8125rem]
  ok     7.11:1 (need 4.5) 11px bold  .eyebrow mb-[0.15rem]
  ok     7.11:1 (need 4.5) 14px  .dim text-sm
  ok    16.38:1 (need 4.5) 18px  .stem mt-5
  ok    18.97:1 (need 4.5) 16px  .choice__body
  ok     7.58:1 (need 4.5) 12px bold  .verdict verdict--bad
  ok    18.97:1 (need 4.5) 16px  .choice__body
  ok        9:1 (need 4.5) 12px bold  .verdict verdict--ok
  ok    14.93:1 (need 4.5) 16px  .choice__body
  ok     8.98:1 (need 4.5) 11px bold  .eyebrow eyebrow--work mb-1 block
  ok     7.08:1 (need 4.5) 11px bold  .eyebrow eyebrow--guide
  ok     5.97:1 (need 4.5) 12px bold  .verdict verdict--bad mt-0
  ok    10.81:1 (need 4.5) 16px  .cite__quote
  ok     4.61:1 (need 4.5) 11px  .cite__src
  ok    10.92:1 (need 4.5) 11px bold  .eyebrow eyebrow--warning mb-1
  ok     6.48:1 (need 4.5) 14px  .dim text-[0.875rem] leading-normal
  ok     5.86:1 (need 4.5) 12px  .faint text-[0.75rem] text-center m
  ok     6.48:1 (need 4.5) 15px  .dim text-[0.9375rem]
A1 measured failures: 0
A6/A2 focus ring (keyboard focus): {"outline":"3px solid rgb(255, 204, 0) offset 2px","vsControl":10.92,"vsPage":11.98}
A2 rails (/progress, seeded): fillVsTrack 3.74 (rail--stop) / 12.40 (rail--warn) / 4.61 (guide); all aria-hidden="true"
```

### 5.16 Resilience, driven by hand against `dist/` — X19 / X20 / X21 / C3 / C5

X19, `tn-drive:progress = {"garbage":true`:

```
Your saved progress can’t be read

The saved file is damaged, so this build will not touch it — writing over it
would destroy whatever is still in there. It is still on the device, exactly as
it was. Nothing has been deleted, and nothing you do in this session will
overwrite it.

WHAT’S ON THE DEVICE
Saved study record   unreadable
This app reads up to schema 1
Answers held         unreadable
Size                 1 KB of 5 MB

Pick one
  Reload and try reading it again
  Export a diagnostic file
LAST RESORT
  Reset saved progress

H1: Your saved progress can’t be read
payload untouched: "{\"garbage\":true"
console noise: 0 []
after reload H1: Your saved progress can’t be read
```

X20, `version: 9999`:

```
The saved file was written by a newer version of TN Drive than the one running
here, so this build will not touch it …

Saved study record   schema 9999
This app reads up to schema 1
Answers held         1

reset button present: 1
after reset, dashboard visible: true
```

X21, `Storage.prototype.setItem` throwing:

```
This browser won’t let the app save

Private browsing, a full storage quota, or a blocked site-data setting is
stopping TN Drive from writing to this device. Nothing is broken and nothing
was lost — you have not answered anything yet. You can study r…

[PASS] X21/C5 — session-only wording present: true; unhandled page errors: 0
```

### 5.17 Offline, by hand, with a warmed precache — F3 / X16 / X17 / X18

```
precache entries in CacheStorage: 34
answered offline: 12 ended: true
landed on: STUDY | EXAM | SIGNS | PROGRESS | BACK | Score report | OFFLINE READY | Stopped at question 12. 5 correct of 30.
failed requests offline: 0 []
console noise: 0 []
  /signs: 6348 chars, h1="Sign library"
  /progress: 2835 chars, h1="Climbing"
  /study: 1262 chars, h1="Plenty of road left"
  /settings: 8651 chars, h1="Settings & about"
  /rules/R225: 2865 chars, h1="Railroad stop distance"
failed requests total: 0 []
```

### 5.18 `npm run verify` — the floor's single answer

`npm run verify` = `typecheck && lint && build && test && test:coverage &&
test:e2e && validate:content && audit:signs && size && test:a11y`
(`package.json:27`) — X1–X8, X7b and X15, exactly as the floor requires.

**It was run twice. It went red both times, and both times only inside
`test:e2e`, and every failure was a 30-second test timeout.** The individual
stages all pass on their own; `npm run test:e2e` on its own passed **299/299 in
55.4 s**. Inside `verify` the same suite took **3.1 min** and **3.0 min**. See
F-2.

Attempt 1:

```
  6 failed
    [mobile] › tests\e2e\foundation.spec.ts:26:3 › foundation › every destination boots and carries a unique title
    [mobile] › tests\e2e\signs.spec.ts:62:3 › sign rendering › the gallery renders the whole registry with no raster or clipart
    [mobile] › tests\e2e\study.spec.ts:37:3 › study session › cell 3 — a question is asked in focus mode, with position and progress
    [desktop] › tests\e2e\dashboard.spec.ts:223:3 › cell 2c — loading › shows the dashboard with its words removed, and no layout jump
    [desktop] › tests\e2e\exam.spec.ts:198:3 › the exam simulator › cell 6d — the full review runs in exam order with a citation on every question
    [desktop] › tests\e2e\foundation.spec.ts:83:3 › foundation › reflows at 320px with no horizontal scrolling (WCAG SC 1.4.10)
  293 passed (3.1m)
EXIT=1
```

Attempt 2 — **a different nine**:

```
  ✘   20 [mobile] › exam.spec.ts:198:3 › cell 6d — the full review … (30.4s)
  ✘   17 [mobile] › exam.spec.ts:122:3 › cell 6a — a passing exam samples 25/25/25/25 … (34.5s)
  ✘  131 [mobile] › study.spec.ts:90:3 › correct and incorrect survive without colour (practices A3) (10.4s)
  ✘  145 [mobile] › study.spec.ts:283:3 › runs a full session without a console error or warning (practices E8) (21.9s)
  ✘  160 [desktop] › exam.spec.ts:122:3 › cell 6a — a passing exam samples 25/25/25/25 … (31.0s)
  ✘  163 [desktop] › exam.spec.ts:198:3 › cell 6d — the full review … (31.1s)
  ✘  198 [desktop] › rules.spec.ts:57:3 › a citation opened from a study explanation lands on the right rule (30.7s)
  ✘  210 [desktop] › settings.spec.ts:225:3 › cell 11c — the erase is refused … (30.6s)
  ✘  209 [desktop] › settings.spec.ts:191:3 › a confirmed reset erases the records … (30.5s)

  9 failed
  290 passed (3.0m)
EXIT=1
```

Every one of those durations is at or just under the 30 000 ms default test
timeout — the clock running out, not assertions about behaviour disagreeing with
the app. In attempt 1 several of the failing cases **passed in the same run on
the other project** (`signs.spec.ts:62` passed on `desktop` in 2.6 s while
failing on `mobile`; `study.spec.ts:37` passed on `desktop` in 3.1 s while
failing on `mobile`).

**Attempt 2 is contaminated and I will not draw a conclusion from it.** Its e2e
phase ran ≈07:28–07:31 and `src/store/settings.ts` was modified by another agent
at **07:30:25** (`tests/pwa/storage-blocked.spec.ts` appeared at 07:31:34); two
of the nine failures are in `tests/e2e/settings.spec.ts`, and the
`mobile`/`desktop` projects are served by a live `vite` dev server that picks up
source edits. See §0.

**I am therefore recording `npm run verify` as *not observed green*, and not as
an X-threshold failure.** X1–X8, X7b and X15 each pass when run individually,
which is the evidence in §5.1–§5.13, and every runtime measurement in this
document came from a `dist/` I built and served myself. What is still owed is
one clean `verify` on an idle checkout — F-2.

### 5.19 The F-5 prototype — explanation numbers with no citation behind them

Not a project script; a throwaway I ran to turn F-5 from a hypothetical into a
list. For each question, take every number in `explanation` and check whether it
appears in any of that question's citation quotes:

```
questions whose explanation states a number absent from every cited quote: 11 of 506
alc-056 -> 19          official-02 -> 10,2     blt-013 -> 12      fol-009 -> 55
alc-057 -> 18          res-009  -> 75          blt-014 -> 20      wrn-001 -> 55
res-014 -> 400         fol-005  -> 55          gde-010 -> 25
```

Checked against `docs/research/tn-dl-manual-extract.txt`:

| id | number | in the manual? | where |
|---|---|---|---|
| res-014 | `$400` | **yes** | extract l.8706 — "four hundred dollars ($400)." |
| res-009 | `$75` | **yes** | extract l.8394 — "$75 in addition to any other fines and costs you may owe." |
| blt-014 | 20 m.p.h. parade exception | **yes** | extract l.3457-3462 — "part of an organized parade, procession or other ceremonial event and the vehicle must not exceed the speed of twenty (20) miles per hour" |
| **gde-010** | "often under **25 m.p.h.**" | **no** | the SMV section on PDF p.54 states no speed at all. The only `25 m.p.h.` in the extract is a roundabout advisory (l.5858) and a driver-record points table (l.8518) |

Three of four are true statements sitting outside their quoted span — a
citation-coverage issue of the same family as F-3. The fourth is a number the
manual does not print, taught in an explanation, with nothing in the pipeline
positioned to notice.

---

## 6. What this audit did **not** cover

Stated so the next reader knows the edges of the evidence.

- **Real devices and real browsers.** Everything runtime here is headless
  Chromium via Playwright. Safari/iOS is not covered — which matters for F6
  (`beforeinstallprompt` never fires there) and for `<dialog>` focus behaviour.
- **Screen-reader output.** A8/A9 were verified by reading the accessibility
  properties, not by listening to NVDA/VoiceOver.
- **The remaining 486 questions.** D2/D3/D16 rest on a 20-question random sample
  plus the validator's exhaustive machine checks. The validator covers verbatim,
  page-exactness, the printed-page arithmetic, one-key, duplicates, topic,
  section, sign references and the never-generate list on **all 506**; only the
  human "does this quote support this key" judgement is sampled.
- **Sign artwork against physical MUTCD plates.** `audit:signs` checks
  designation, palette, shape and legend containment; my own spot-check covered
  10 of 87 entries. Nobody has held the rendered faces against the MUTCD figure
  sheets one by one.
- **Lighthouse variance.** X10 was run twice on one machine. The 88/85/87 spread
  is that machine's; a CI number could differ.
- **A quiet checkout.** Another agent held the repo and the CPU throughout (§0).
  Everything runtime here was measured against a `dist/` I built and served
  myself, so those rows stand — but `npm run verify` has never been observed
  green here, and that single clean run is the one piece of evidence this audit
  could not produce.
