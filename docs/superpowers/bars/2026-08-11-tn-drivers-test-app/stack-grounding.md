# Stack Grounding — TN Driver Test App

**This document is the feasibility ground truth.** Mockups are generated under
it; builders build within it; critics may cite it to reject a mockup as
infeasible. Nothing may be built that this document forbids.

---

## 1. Platform & framework

| Concern | Decision | Why / constraint it imposes |
|---|---|---|
| Type | Installable PWA, offline-first | Studied on a phone, often with poor signal (a Driver Service Center parking lot). Everything must work at zero bytes of network after first load. |
| Build | Vite 7 + React 19 + TypeScript 5 (strict) | Static output, no server. Deployable to any static host. |
| Routing | `react-router` v7 (declarative mode, `createBrowserRouter`) | SPA fallback required on host. Deep links must work offline. |
| State | `zustand` + `persist` middleware | Small, no provider tree, trivially testable outside React. |
| Persistence | `localStorage` via a **versioned, migrated** schema (`schemaVersion` int) | Hard cap ~5MB. Attempt history must be bounded (see §6). No server, no account, no sync. |
| Styling | Tailwind CSS v4 with a project token layer in `@theme` | Single source of design truth all pieces import — this is what keeps parallel builders visually cohesive. |
| Service worker | `vite-plugin-pwa` (Workbox), `registerType: 'prompt'` | Must precache **all** app shell + fonts + question bank. Update prompt, never silent reload mid-exam. |
| Animation | CSS transitions/animations + `motion` (React) only where it earns it | Must respect `prefers-reduced-motion` everywhere. |
| Charts | Hand-authored inline SVG | No chart library. Offline weight budget; also nothing generic-looking. |
| Testing | Vitest + Testing Library (unit/integration), Playwright (e2e + screenshots) | Critics drive Playwright themselves. The app must be launchable with one command. |

### What this stack cannot do — do not mockup these
- No native push notifications on iOS Safari for a non-installed PWA. **No design may depend on push reminders.**
- No background sync, no server-side scoring, no accounts, no cross-device sync, no leaderboards.
- No camera/AR sign recognition.
- No audio narration unless the asset ships in the bundle (budget below forbids it).
- No external font/image/API requests at runtime — CSP-hostile and breaks offline.

---

## 2. Design language (the identity all pieces must share)

### The thesis
**The interface is the roadway.** The app's entire visual system is built from
real American highway-signage vocabulary — MUTCD colors, sign geometry,
retroreflective feel, highway-gothic lettering. Color is never decorative: a
color in this app means what it means on a real Tennessee road. Learners
absorb the curriculum by living inside it.

Dark-first, because the memorable version of this material is a sign lit by
headlights at night.

### Color tokens (MUTCD-derived; semantic, not decorative)

| Token | Value | Meaning — enforced, not stylistic |
|---|---|---|
| `--color-asphalt` | `#14161A` | Base background |
| `--color-asphalt-raised` | `#1C1F25` | Panel / card surface |
| `--color-shoulder` | `#2A2F38` | Borders, dividers, rules |
| `--color-guide` | `#04684E` | **Guide green.** Primary brand + primary action. |
| `--color-guide-lit` | `#0A8F6C` | Hover / focus state of primary |
| `--color-sign-white` | `#F2F4F1` | Primary text, sign faces |
| `--color-sign-dim` | `#9BA3AE` | Secondary text |
| `--color-warning` | `#FFCC00` | **Warning yellow.** Diamond signs, caution, streaks, "review this". |
| `--color-stop` | `#B4151C` | **Regulatory red.** Wrong answers, stop/prohibition, destructive actions. |
| `--color-work` | `#E35205` | **Construction orange.** Work-zone content, in-progress states. |
| `--color-route` | `#003F87` | **Interstate blue.** Motorist services, informational, links. |
| `--color-school` | `#C7EA00` | **Fluorescent yellow-green** — school, pedestrian and bicycle warning signs (MUTCD). |
| `--color-incident` | `#EE5FA7` | Fluorescent pink — **incident management only.** Not school. Conflating the two is a factual error in the curriculum, not a style choice. |

**Sign faces and UI text are different jobs and use different tokens.** A sign
face must use its true MUTCD color; UI *text* must pass WCAG AA. The MUTCD
greens and reds do not: measured, `--color-guide-lit` is 4.45:1 and
`--color-stop-lit` is 3.64:1 on asphalt, both under the 4.5:1 this project
commits to in §5. So:

| Text token | Value | Contrast |
|---|---|---|
| `--color-guide-text` | `#2FBF95` | 7.1:1 on raised surface |
| `--color-stop-text` | `#FF6B70` | 6.5:1 on asphalt |
| `--color-work-text` | `#FF8A4C` | legible as text |
| `--color-sign-dim` | `#9BA3AE` | 7.2:1 |
| `--color-sign-faint` | `#808894` | 4.6:1 |

**Never set body text in `--color-guide-lit` or `--color-stop-lit`.** Sign
faces keep `#04684E` / `#B4151C` untouched — the design thesis is preserved
exactly, because it was never about the text color.

Rules: primary action is always `--color-guide`. Correct is `--color-guide`,
never a generic green. Incorrect is `--color-stop`. A sign rendered in the app
uses its **real** MUTCD color — a warning sign is yellow even if that clashes
with the surrounding panel. Accuracy outranks harmony here; that is the point.

### Typography (self-hosted woff2 only — no CDN, offline requirement)

| Role | Face | Rationale |
|---|---|---|
| Display / UI | **Overpass** | Open-source face explicitly derived from FHWA Highway Gothic — the actual lettering on the signs being taught. Subject-derived, not a trend pick. |
| Data / numerals | **Overpass Mono** | Timers, scores, mile markers, counts. Tabular figures required. |
| Reading | **Newsreader** | Explanations, rule text, manual quotations. The deliberate split: highway gothic is *the road*, the serif is *the book/the law*. Optical sizing at reading sizes. |

Body copy sets in Newsreader at ≥17px with ≥1.6 line-height. Question stems set
in Overpass (they are the "sign"); explanations set in Newsreader (they are
"the manual"). This split is a design rule, not a suggestion.

### Structural devices — each must encode something true
- **Route shield** — mastery level. Not decoration.
- **Mile marker** — position in a session ("MILE 12 / 30"). Only where an ordered sequence genuinely exists.
- **Diamond** — a caution/review affordance. Only for content the learner is weak on.
- **Octagon** — a hard stop. Exam failure, destructive confirmation.
- **Lane striping** — progress rails and dividers.

Numbering (01/02/03) is permitted **only** in the exam simulator and study
session, where order is real. Never on the dashboard.

### Texture / atmosphere
A single restrained retroreflective treatment: a low-opacity radial sheen plus
a fine grain overlay on sign faces, evoking glass-bead sheeting. Applied to
sign artifacts only — never to whole pages. Must be pure CSS/SVG (no raster).

### The signature
**Every sign in the app is a spec-accurate, hand-authored SVG** — correct
shape, correct MUTCD color, correct proportion — and the app's own chrome is
built from that same sign system. Your readiness reads as a speed-limit sign;
your streak reads as a route shield; a failed exam reads as a stop octagon.
There is no clipart and no photography anywhere in this product.

**Restraint rule:** the signage system is the *one* bold move. Everything
around it — spacing, panels, forms, settings — stays quiet, dark, and
disciplined. Boldness is concentrated, not spread.

---

## 3. Component vocabulary (greenfield — this is the list that will exist)

Builders may use **only** these. Adding a component means adding it here first
via a deviation.

`SignSvg` (the MUTCD sign renderer, driven by a sign registry) · `SignPanel`
(surface/card) · `Button` (variants: guide / quiet / danger) · `ChoiceRow`
(states: neutral / **picked-verdict-withheld** / correct / incorrect / muted —
the picked state is achromatic and keyed off `aria-pressed`, because in exam
mode any color would leak the answer) · `QuestionCard` ·
`ExplanationBlock` (rule + verbatim manual quote + citation) · `MileMarker` ·
`RouteShield` · `ProgressRail` · `TopicMeter` (head + rail; thresholds ≥80%
guide, 50–79% warn, <50% stop; the head states the numbers in text so the rail
is never the only carrier) · `StatTile` · `Timer` · `StrikeCounter` (the
7-wrong rule, glanceable at all times) · `VerdictSign` (variants: pass /
short / halted — the signature moment of the exam flow) · `FocusChrome`
(focus-mode top bar + bottom action shelf; owns the nav offset so no page
undoes `body` padding) ·
`EmptyState` · `ErrorState` · `LoadingSkeleton` · `Toast` · `Dialog` (native
`<dialog>`) · `AppNav` (bottom bar on mobile, side rail ≥1024px — **owns the
brand block**, rendered in rail mode only, so no page positions it) ·
`OfflineBadge` · `CitationLink` · `VisuallyHidden`

Form vocabulary — **no raw browser controls.** `<input type="date">` and a
native checkbox are OS- and browser-dependent, cannot be made cohesive, and
read as defaults. Ratified additions:

- `DateField` — segmented month / day / year numeric inputs in one field, each with its own visible label; Overpass Mono tabular values. Build owns auto-advance, paste, clamping, and a live echo of the resolved date.
- `ConfirmGate` — the acknowledgement step on a destructive action. A **real** `<input type="checkbox">` for semantics, visually replaced via `appearance: none`; the checked state carries a tick (a shape), never colour alone. Not a `role="checkbox"` div.
- `SwitchRow` · `SegmentedField` · `SearchField` · `Chip` (filter pill; pressed state carries a tick, not just a fill).

Panel variants: `guide` / `stop` / `warn` / `route` (interstate blue =
motorist services and informational, per §2).

**App bar — one pattern across the whole set:**
`[ optional back-link · page title · context line ] —— offline badge`.
The brand is **never** in the page header; `AppNav` renders it at the head of
the desktop side rail. The context line hides below 900px, where the title and
badge need the full bar.

---

## 4. Navigation idiom

- **Mobile (<1024px):** fixed bottom tab bar — Study · Exam · Signs · Progress. Safe-area inset respected.
- **Desktop (≥1024px):** left side rail, same four destinations, content max-width 720px for reading measure.
- Study session and exam simulator are **full-screen focus modes** — nav hidden, explicit exit with confirmation mid-exam.
- Back/forward must behave: browser back inside an exam prompts, never silently discards.

---

## 5. Accessibility baseline (committed, non-negotiable)

- **WCAG 2.2 level AA.** Text contrast ≥4.5:1, UI/graphics ≥3:1 against their adjacent surface.
- **Color is never the sole carrier of meaning** — this is doubly load-bearing here, since the design is built on color semantics and a red/green colorblind learner is squarely in the audience. Correct/incorrect always pair color with an icon *and* text.
- Every interactive element keyboard-reachable, in logical order, with a visible focus ring (≥3:1, never `outline: none` without replacement).
- All sign SVGs carry accessible names describing shape + color + meaning, since that *is* the content being taught.
- Answer selection and result announced via a live region.
- Full support for `prefers-reduced-motion: reduce` — no parallax, no autoplay, no motion-dependent information.
- Target size ≥24×24 CSS px (WCAG 2.2 SC 2.5.8); answer choices ≥44px tall.
- Zoom to 200% without loss of content or function; supports 320px viewport width.

---

## 6. Hard constraints the practices component will enforce

- No secrets, keys, or analytics beacons in the client bundle.
- No runtime network requests at all after install — verifiable by loading offline.
- No PII leaves the device. No account. No third-party scripts.
- `localStorage` writes are schema-versioned and migration-tested; a corrupt or
  future-version payload must degrade to a recoverable state, never a white screen.
- Attempt history bounded (retain most recent 200 attempts + aggregate rollups)
  so the 5MB quota is never hit.
- TypeScript `strict`, no `any` in application code, no `@ts-ignore` without a cited reason.
- The question bank is **data, not code** — typed JSON validated at build time.
- **Every question carries a citation** to the official manual (PDF page + verbatim supporting quote). A question without one fails the build.

---

## 7. Content ground truth

- **Primary source:** Tennessee Comprehensive Driver License Manual, TN Dept. of Safety & Homeland Security — `https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf` (135pp, content current as of **July 1, 2022** per its own front matter, though the PDF also carries a March 2025 printing authorization; both recorded, neither reconciled by the source). The manual states it is **not copyrighted and may be reproduced**, which settles the licensing question for building study content on it.

### The exam blueprint — published by the manual itself (PDF p.31)

> "The test will consist of multiple choice questions based on information
> contained in sections B and C of this manual. You can expect the test to
> approximately consist of the following four areas:
> Traffic signs and signals—25% · Safe driving principles—25% ·
> Rules of the road—25% · Drugs and alcohol—25%"

Binding consequences:
- Mock exams sample to **25/25/25/25**, never to page count.
- Content comes from **Sections B and C only**; Section A (fees, document checklists, office procedure) is out of the exam pool.
- **Three answer options (A/B/C) is the real format** — the manual's own sample questions are three-option. Four-option items misrepresent the exam. Combination distractors ("Both A and B") are idiomatic and permitted.
- The manual's **27 state-authored sample questions** (8 "Chapter Sample Test Questions" sets + answer key) are the only items authored by the testing authority. They ship verbatim and identifiable.
- Extracted text and structured spine: `docs/research/manual-spine.md`.
- The manual explicitly disclaims currency. Post-2022 verified corrections live in `docs/research/live-facts.md` and **override** the manual where they conflict; any such override must be visible to the learner, not silently applied.
- The app must state its source and its non-affiliation with the State of Tennessee.

---

## 8. Performance & size budget (the executable floor)

| Metric | Threshold |
|---|---|
| Initial JS (gzipped, excl. question bank) | ≤ 180 KB |
| Total precached payload | ≤ 2.5 MB |
| Lighthouse Performance (mobile emulation) | ≥ 90 |
| Lighthouse Accessibility | = 100 |
| Lighthouse Best Practices | ≥ 95 |
| Lighthouse PWA installability | passes |
| First answer interactive after cold load | ≤ 2.5 s on Slow 4G emulation |
| Works fully with network disabled | yes — hard requirement |

---

## 9. Repo conventions

- `src/` app code · `src/content/` question bank + sign registry (typed JSON + loaders) · `src/signs/` SVG sign components · `docs/research/` sources · `docs/superpowers/bars/` this bar.
- One command to run: `npm run dev` (port 5173). One to verify: `npm test`. One to build: `npm run build`. One to preview production+SW: `npm run preview` (port 4173).
- Conventional commits. No commits to `main` without the work being on a branch first.
