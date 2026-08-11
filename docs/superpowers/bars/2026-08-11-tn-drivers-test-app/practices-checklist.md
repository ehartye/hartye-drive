# Practices Checklist

Every item is **independently checkable** by a critic against the code or the
running app, with a source cited. "Follows best practices" is not an item.

Pass condition: every item checked, or a deviation filed in `deviations.md` and
accepted. A critic that cannot verify an item marks it **UNVERIFIED**, which
counts as a gap.

---

## A. Accessibility — WCAG 2.2 level AA

| # | Item | Source | How to check |
|---|---|---|---|
| A1 | All text has ≥4.5:1 contrast against its background (≥3:1 for ≥24px or ≥19px bold) | WCAG 2.2 SC 1.4.3 | Axe scan + manual spot-check of sign faces on dark panels |
| A2 | UI components and meaningful graphics have ≥3:1 contrast against adjacent colors | WCAG 2.2 SC 1.4.11 | Axe + manual on `.rail`, borders, focus rings |
| A3 | **Color is never the sole means of conveying information** — correct/incorrect pair color with an icon *and* a word | WCAG 2.2 SC 1.4.1 | Grayscale the answer-revealed screens; meaning must survive |
| A4 | Every interactive element is reachable and operable by keyboard, in a logical order | WCAG 2.2 SC 2.1.1, 2.4.3 | Tab through every screen; complete a full question with keyboard only |
| A5 | No keyboard trap; focus is never lost or sent to `<body>` after a state change | WCAG 2.2 SC 2.1.2 | Tab through dialogs, exam exit confirm |
| A6 | Focus indicator is visible, ≥3:1 against adjacent color, and never removed without replacement | WCAG 2.2 SC 2.4.7, 2.4.11 | Search codebase for `outline:none` / `outline: 0`; visually confirm |
| A7 | Target size ≥24×24 CSS px; answer choices ≥44px tall | WCAG 2.2 SC 2.5.8 | Measure in devtools |
| A8 | Every sign SVG carries an accessible name describing shape + color + meaning — except in drill mode, where the name must not give away the answer | WCAG 2.2 SC 1.1.1 | Read the a11y tree; confirm drill names are shape/color only |
| A9 | Answer results are announced to assistive tech via a live region | WCAG 2.2 SC 4.1.3 | Inspect for `aria-live`; verify it announces once, not on every render |
| A10 | Page has one `<h1>`, headings descend without skipping levels | WCAG 2.2 SC 1.3.1 | Heading-order audit |
| A11 | All form controls have programmatically associated labels | WCAG 2.2 SC 3.3.2 | Axe |
| A12 | Content reflows at 320px width and at 200% zoom with no loss of function and no two-dimensional scrolling | WCAG 2.2 SC 1.4.10 | Resize to 320px; zoom to 200% |
| A13 | `prefers-reduced-motion: reduce` disables all non-essential animation | WCAG 2.2 SC 2.3.3 | Emulate the media feature; confirm no transitions/animations run |
| A14 | Each page/route has a unique, descriptive `<title>`; `<html lang="en">` is set | WCAG 2.2 SC 2.4.2, 3.1.1 | Navigate all routes |
| A15 | Timed exam meets the timing exception honestly: the 60-minute limit is essential to the simulation and is disclosed before starting | WCAG 2.2 SC 2.2.1 | Confirm disclosure exists before the timer starts |
| A16 | Dialogs use native `<dialog>` (or equivalent), trap focus while open, restore focus on close, and close on Escape | WAI-ARIA APG — Modal Dialog | Open exam-exit confirm and settings reset confirm |
| A17 | Nothing relies on hover alone; all hover-revealed information is also available on focus | WCAG 2.2 SC 1.4.13 | Keyboard-only pass |

## B. Security & privacy

| # | Item | Source | How to check |
|---|---|---|---|
| B1 | No secrets, API keys, or tokens in the client bundle | OWASP Top 10 A02:2021 | `grep` the built `dist/` for key-like strings; review `.env` usage |
| B2 | **Zero network requests after first load** — no analytics, no fonts from a CDN, no telemetry | Project constraint (grounding §6) | Load app, clear network log, use it fully, confirm zero requests |
| B3 | No third-party scripts of any kind | OWASP A08:2021 | Inspect `index.html` and bundle imports |
| B4 | No PII collected, stored, or transmitted; no account, no email | Project constraint | Inspect the persisted state shape |
| B5 | A restrictive CSP is set (no `unsafe-eval`; `default-src 'self'`) and documented | OWASP Secure Headers | Read the meta tag / host config; confirm the app runs under it |
| B6 | No `dangerouslySetInnerHTML` with non-constant input anywhere | OWASP A03:2021 | `grep` the codebase |
| B7 | Dependencies have no known high/critical advisories | OWASP A06:2021 | `npm audit --omit=dev` |

## C. Data integrity & resilience

| # | Item | Source | How to check |
|---|---|---|---|
| C1 | Persisted state carries an integer `schemaVersion` | Project convention (grounding §6) | Read the store; inspect `localStorage` payload |
| C2 | A migration path exists and is unit-tested for every prior schema version | Project convention | Read migration tests; confirm they run |
| C3 | Corrupt, truncated, or future-version persisted state degrades to a recoverable screen — **never a white screen** | Project convention | Write garbage into the key, reload, observe |
| C4 | Attempt history is bounded (≤200 attempts retained) so the storage quota is never reached | grounding §6 | Read the pruning logic; confirm a test covers it |
| C5 | A `localStorage` write failure (quota/private mode) is caught and surfaced as the session-only mode, not an unhandled rejection | MDN Storage API | Stub `setItem` to throw; observe |
| C6 | An error boundary wraps the app and renders the recoverable error state | React docs — Error Boundaries | Force a render throw |

## D. Content fidelity — the item that makes this app trustworthy

| # | Item | Source | How to check |
|---|---|---|---|
| D1 | **Every question carries a citation**: manual PDF page + verbatim supporting quote. A question without one fails the build | grounding §6 | Run the content validator; confirm it fails on a citation-less fixture |
| D2 | Every cited quote appears **verbatim** in the extracted manual text | grounding §7 | Validator does exact substring matching against `docs/research/` extract |
| D3 | The quote actually supports the keyed answer — spot-audited, not just present | Judgment | Critic samples ≥15 random questions and reads each quote against its answer |
| D4 | Exactly one keyed correct answer per question; no duplicate or overlapping choices | Content invariant | Validator |
| D5 | Sign registry entries have correct MUTCD shape, color, and meaning | MUTCD 2009 Ed. / TN manual signs chapter | Critic checks a sample against the manual's signs chapter |
| D6 | Facts superseded after the manual's July 1, 2022 currency date are corrected from `docs/research/live-facts.md`, and the correction is **visible to the learner**, not silent | grounding §7 | Locate each conflict; confirm the UI discloses it |
| D7 | The app states its source and its non-affiliation with the State of Tennessee | Consumer-honesty | Visible on dashboard footer and About |
| D8 | Exam simulation matches real TN rules: 30 questions, 24 to pass, 60-minute limit, early termination at 7 wrong | `docs/research/live-facts.md` (verified against primary sources) | Read the exam engine + its tests |
| D9 | **The exam blueprint is honored.** The manual publishes it: traffic signs and signals 25%, safe driving principles 25%, rules of the road 25%, drugs and alcohol 25%, drawn from Sections B and C only. Mock exams sample to these proportions — not to page count, which would over-weight rules of the road and under-weight alcohol | Manual, PDF p.31 (`tn-dl-manual-extract.txt` line 2413–2421) | Read the exam sampler; run 10 mock exams and check the topic distribution |
| D12 | **Answer options follow the real format: 3 options (A/B/C) by default.** The manual's own sample questions are three-option; four-option items misrepresent the exam. 2 or 4 permitted only where the item genuinely needs it (e.g. combination distractors like "Both A and B", which the manual uses) | Manual, Chapter Sample Test Questions (8 sets) | Validator enforces `2 ≤ options ≤ 4`; report the distribution — the overwhelming majority must be 3 |
| D13 | The manual's **27 state-authored sample questions** ship as an identifiable, verbatim set — they are the only items whose provenance is the testing authority itself | Manual, 8 × "Chapter Sample Test Questions" + answer key | Confirm they exist, are marked as official, and match the manual verbatim |
| D14 | Content is drawn from **Sections B and C**. Section A material (fees, document checklists, office procedure) is excluded from the exam pool | Manual, PDF p.31 | Check topic taxonomy provenance |
| D10 | The post-2022 corrections verified in `live-facts.md` are applied **and disclosed** where the manual states a now-superseded fact. **Each disclosure carries its real effective date — no vague "in force 2023":** Move Over Law expanded to any vehicle with activated hazard lights, **eff. 2023-07-01** (Jabari Bailey Highway Safety Act, HB0092 / Public Chapter 354); aggravated vehicular assault/homicide BAC threshold 0.20 → **0.15, eff. 2025-07-01** (Public Chapter 430); REAL ID enforcement live since **2025-05-07**. **Note:** the manual states no insurance dollar amounts at all, so there is nothing to correct there — do not present the 25/50/25 figures as a correction to text that does not exist | `docs/research/live-facts.md` + `manual-spine.md` caveat "topics absent" | Locate each in the content; confirm a visible "updated since the manual" affordance carrying the date and the public chapter |
| D11 | Content flagged low-confidence in `live-facts.md` (e.g. left-lane fine amounts) is **not taught as fact** | `docs/research/live-facts.md` | Grep the question bank for those topics |
| D15 | A **never-generate list** exists in the content pipeline and is enforced by the validator. It must contain, at minimum: the four internal contradictions in `manual-spine.md` (Move Over Law lane threshold pp.69 vs 86; renewal cycle 5-yr vs 8-yr; TDL fee arithmetic; GDL fees Tables 2.4 vs 3.2), the undefined age-17 back-seat-belt case (p.45), and the p.120 bicycle sentence that reads as permission but is a warning about child behavior and contradicts p.119 | `manual-spine.md` caveats | Read the list; confirm the validator rejects a question tagged to a banned rule id |
| D16 | Citations record **both** the PDF page and the printed page (`printed = PDF − 14` for PDF pp.15–132). The manual's own sample-question answer pointers use *printed* numbers — a citation that silently mixes the two sends learners to the wrong page | `manual-spine.md` page mapping | Spot-check 5 citations against the PDF |
| D17 | The ~9 signs whose meaning exists only as a caption with no prose in the manual (CATTLE CROSSING, WINDING ROAD, NO TRUCKS, NO U TURN, …) are either given a meaning from an authoritative non-manual source **with that source cited**, or excluded. They are never given an invented meaning | `manual-spine.md` sign caveats | Check the registry's citation field for these entries |
| D18 | Sample question 7 ("The sign at the right means:") and any other manual question that is unanswerable without the missing artwork is either paired with the app's own rendered sign or excluded from the official set | `manual-spine.md` | Locate it in the official question set |

## E. Stack idioms & code quality

| # | Item | Source | How to check |
|---|---|---|---|
| E1 | TypeScript `strict: true`; no `any` in application code; no `@ts-ignore` without a cited reason | TypeScript docs | Read `tsconfig.json`; `grep` for `any`/`@ts-ignore` |
| E2 | `npm run build` produces zero TypeScript and zero lint errors | Project convention | Run it |
| E3 | No `useEffect` used for derived state that could be computed during render | React docs — "You Might Not Need an Effect" | Review every `useEffect` |
| E4 | Keys on list items are stable ids, never array indices | React docs — Lists and Keys | `grep` for `key={i` / `key={index` |
| E5 | The question bank is typed data validated at build time, not code | grounding §6 | Confirm the validator runs in `prebuild` or `build` |
| E6 | Business logic (scoring, scheduling, adaptive selection) lives outside React components and is unit-tested without a DOM | Testability | Read the module layout |
| E7 | Routes are code-split so the initial bundle stays within budget | Vite/React docs | Inspect the build output chunks |
| E8 | No console errors or warnings during a full session in production build | Baseline hygiene | Watch the console through a complete study + exam run |

## F. PWA & offline

| # | Item | Source | How to check |
|---|---|---|---|
| F1 | A valid web app manifest with name, icons (192 + 512, incl. maskable), theme/background color, `display: standalone` | W3C Web App Manifest | Lighthouse installability audit |
| F2 | Service worker precaches the app shell, fonts, and question bank | Workbox docs | Read the generated SW; check the precache manifest |
| F3 | **The app works fully with the network disabled** — cold start, study, exam, signs, progress | Project constraint | Set browser offline, hard-reload, complete a full session |
| F4 | Updates are prompted, never applied silently mid-session | Workbox `registerType: 'prompt'` | Read the registration; confirm no auto `skipWaiting` |
| F5 | Fonts are self-hosted `woff2`, subset, `font-display: swap` — zero requests to Google Fonts | grounding §2 | `grep` for `fonts.googleapis.com`; inspect network |
| F6 | The install prompt is offered at a sensible moment, and dismissal is respected | Chrome docs — `beforeinstallprompt` | Trigger and dismiss |

---

## Deliberately excluded (ratified exclusions)

- **Internationalization / RTL.** The test is administered in English by the State of Tennessee. Out of scope; not a gap.
- **Cross-device sync, accounts, cloud backup.** Excluded by the no-account constraint — this is the privacy posture, not an omission.
- **Push notification study reminders.** Not reliably available for iOS web; grounding §1 forbids designing for it.
- **Server-side anything.** Static hosting is a hard constraint.
