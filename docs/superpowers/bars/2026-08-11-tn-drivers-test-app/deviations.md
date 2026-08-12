# Deviations

The bar freezes at ratification. A builder who believes a bar item is
infeasible or wrong does **not** build around it silently and does **not**
redefine it — they append here, continue with the rest of the piece, and the
human resolves it at the next checkpoint.

Everything below the resolutions table was filed during **Phase 1, before the
freeze**, by the mockup agents. Phase 2 entries stay OPEN until ruled on.

---

## Lead resolutions — Phase 1 (2026-08-11, pre-freeze)

Three of these were defects in the shared layer I authored. The mini-gauntlet
existing to catch exactly this is the reason they cost nothing.

| Finding | Ruling |
|---|---|
| **WCAG contrast failure** in `_base.css` semantic text colors (`--guide-lit` 4.45:1, `--stop-lit` 3.64:1, `--sign-faint` 3.74:1 — all under the 4.5:1 §5 commits to) | **ACCEPTED — fixed, and it was the most important finding of Phase 1.** Independently re-derived the luminance math; the measurement is right. Added text-only tokens `--guide-text #2FBF95`, `--stop-text #FF6B70`, `--work-text #FF8A4C`, and raised `--sign-faint` to `#808894`. `.verdict--ok/--bad`, `.eyebrow--guide/--stop` and `.faint` now point at them. **Sign faces keep true MUTCD `#04684E` / `#B4151C`** — the thesis was never about text color. Grounding §2 now states the two-job rule explicitly. The agent was right not to paper over it locally. |
| **School signs rendered fluorescent pink** | **ACCEPTED — fixed.** A factual error in my sprite, not a style choice: MUTCD school/pedestrian/bicycle warning signs are **fluorescent yellow-green**; fluorescent pink is **incident management**. Token split into `--school #C7EA00` and `--incident #EE5FA7`; `#sg-school` re-rendered. On an app whose premise is sign accuracy, shipping this would have taught a wrong fact. |
| Missing focus-mode chrome (`.focusbar`, `.exit`, `.actionbar`, body offset) duplicated across 4 files | **ACCEPTED — absorbed** into `_base.css` as `body.focus` + `FocusChrome`. Added to §3. |
| `ChoiceRow` has no "selected, verdict withheld" state | **ACCEPTED — absorbed** as `.choice[aria-pressed='true']`, deliberately achromatic. The agent's reasoning is right: any color in exam mode leaks the answer, and the `aria-pressed` hook makes the state unforgeable. Added to §3. |
| `TopicMeter` has a head but no bar | **ACCEPTED — absorbed**, including the threshold contract (≥80% guide / 50–79% warn / <50% stop) and the rule that the head states numbers in text so the rail is never the sole carrier. |
| `Timer` listed but unstyled; no `StrikeCounter` for the 7-wrong rule | **ACCEPTED — absorbed** as `.timer` and `.strikes`. Both added to §3. |
| No `VerdictSign` — 3 score reports duplicated `.plaque` | **ACCEPTED — absorbed** with `pass / short / halted` variants. Added to §3. |
| `#sg-guide` letterboxes in square `.sign--*` sizes | **ACCEPTED — fixed.** `.sign--wide` now carries a matching height. |
| `.sign--hero` for drill dominance | **ACCEPTED — absorbed.** Dominance is the drill screen's thesis; 148px doesn't carry it at 390px. |
| `.sr-only` missing | **ACCEPTED — absorbed**; `VisuallyHidden` added to §3. |
| `.panel--route` missing | **ACCEPTED — absorbed.** §2 already assigned interstate blue to informational/services. |
| `.skel--onsign` missing | **ACCEPTED — absorbed.** The default shimmer is invisible on a guide-green face. |
| Side rail reserves 5.5rem for a brand the shared layer doesn't ship | **ACCEPTED — assigned.** §3 now states `AppNav` owns the brand block in rail mode. |
| Storage error uses the warning diamond, not the octagon | **ACCEPTED — ratified reading.** Recoverable ≠ hard stop. Exactly the distinction §2 intends. |
| `#sg-noturn` is No U-Turn, not No Left Turn | **ACKNOWLEDGED.** Correctly labeled rather than mislabeled. The build's registry needs a separate No Left Turn symbol. |
| Sign registry: mockups show 22, dashboard claims 84 | **RULING REVISED (round 2).** My first ruling — "ratified mockup limitation" — was wrong, and a later agent was right to keep pushing on it. It left a live contradiction inside the spec: onboarding and the dashboard said 84 while the library and settings said 22, so a builder reading the library screens would spec a registry a quarter the size the bar requires. **The whole set is now unified on 84**, with mastery at 61/84 — which reconciles exactly with the dashboard's "Road signs learned 61 of 84". The mockup *sprite* still renders 22 hand-drawn signs; `08c`'s label now says so explicitly ("full library, 84 signs; sprite renders 22"), so the density cell stays honest without the spec lying about inventory. `executable-floor.md` still requires **≥80 signs in the built registry**. |
| Mockup citations use placeholder page numbers | **RATIFIED.** The mockups freeze the citation *format*; `practices-checklist.md` D1–D2 require real verbatim quotes with real page numbers in the build, machine-validated. |
| Mockups load Google Fonts from a CDN | **NOT A DEVIATION.** Mockups are static artifacts, not the shipped app. Grounding §2 and practices F5 require the *build* to self-host woff2. Critics must not flag this against the mockups. |
| Construction and School categories have one sign each | **ACKNOWLEDGED — build requirement.** The built registry needs 3–4 orange work-zone signs and a school-bus stop-arm; TN school-bus law is heavily tested. |

**Lead-initiated correction, not agent-filed:** all study/exam/drill mockups
were authored with four answer options. The manual's own sample questions use
**three (A/B/C)**, and it publishes its exam blueprint outright. Corrected to
three across `03`, `04a`, `04b`, `05`, `07`; grounding §7,
`practices-checklist.md` D9/D12–D14 and `executable-floor.md` updated to make
the three-option format and 25/25/25/25 sampling binding.

---

## 2026-08-11 — Sign trainer, sign library, rule reference (mockups 07, 08, 08b, 08c, 10)

### New components requested for §3 component vocabulary

| Component | What it is | Why the existing list can't carry it |
|---|---|---|
| `SignCard` | Grid cell: `SignSvg` + sign name + one-line meaning + `MasteryPips`, wrapped as a link to the rule reference. | The library is a browse surface. `SignPanel` is a generic card; it has no notion of a sign's identity, meaning, or the learner's grasp of it. |
| `SignCategoryHeader` | Category name + count + the category's shape/colour rule set in reading type, with a left rule in the category's MUTCD colour. | This is the teaching payload of the library — a plain `h2` renders it as a section label rather than a lesson. |
| `SignFilterBar` | Search field + category filter chips (`aria-pressed`), plus the "no matches" variant of the field. | No form/search primitive exists in the list at all. |
| `MasteryPips` | Three pips + a word (`Solid` / `Review` / `New`). | `RouteShield` encodes mastery at hero scale and `TopicMeter` encodes it per topic; neither survives at 132px grid scale. Pips + a word keep colour from being the sole carrier (§5). |
| `SignStage` | The drill presentation: one sign at hero scale, on a post, over a fading ground line, lit by an off-axis sheen. | The drill's whole thesis is that the sign is the subject. A `SignPanel` frames it as content among content. |
| `DrillModeToggle` | Two-state quiet segmented control: `Meaning` ⇄ `Shape & color`. | Nothing in the list toggles what a drill asks for. Deliberately styled to recede. |
| `RuleList` | Requirement list marked with lane stripes rather than numerals. | §2 forbids `01/02/03` numbering outside the exam simulator and study session, and these requirements are not a sequence. |
| `RelatedQuestionRow` | Question stem + its attempt status (word + icon + colour) + chevron. | `ChoiceRow` is a selectable answer, not a navigational record of past attempts. |

### Utility missing from the shared layer

- **`.sr-only`** — visually hidden text. Needed for the search field label and the
  drill's answer live region. Currently redefined in each mockup's `<style>`.
  **Recommend promoting into `_base.css`** so it exists once.

### Sprite gaps found while building (`_signs.js`)

- **Construction has exactly one sign** (`#sg-workzone`). No flagger, no
  `ROAD WORK AHEAD` plaque, no lane-closure arrow, no channelizing device. The
  Construction category in the library is therefore a single card carrying a
  whole category's teaching. Real coverage needs 3–4 more orange signs.
- **School has exactly one sign** (`#sg-school`). No school-bus stop-arm, no
  `SCHOOL SPEED LIMIT` panel — and TN school-bus law is a heavily tested topic.
- **`#sg-noturn` renders a U-turn arrow, not a left-turn arrow.** It is a No
  U-Turn sign (R3-4), and is labelled as such in the library. If a No Left Turn
  (R3-2) is wanted, the sprite needs a second symbol.
- **`#sg-nopassing`** is the pennant only, with no legend. Correct as a shape
  lesson; a learner also needs to see the `NO PASSING ZONE` wording.
- No pavement-marking artwork exists, so railroad content cannot show the
  painted `RXR` and stop line that the manual pairs with the crossbuck.

### Content deviations

- **School-zone colour.** The sprite renders the school pentagon in the project's
  school pink (`--school`), per the §2 token. On a real Tennessee road these are
  fluorescent yellow-green. The library states this openly in the School category
  note and teaches the pentagon *shape* as the identifier, so the mockup does not
  assert a false fact.
- **Library inventory is 22 signs**, the full contents of the sprite. The
  dashboard exemplar (`02-dashboard-populated.html`) states "Road signs learned
  61 of 84". These two numbers do not reconcile. The library pages use 22
  consistently (16 solid / 4 review / 2 new). **Needs a ratified registry size**
  before the build.
- **Manual quotations are illustrative.** Page numbers are placeholders and the
  wording in mockup 10 is written to the manual's register, not transcribed from
  it. §6 requires real verbatim quotes at build time; the mockups freeze the
  *format* (`Manual · Section: X · p. N`), not the text.

### Scoped override of a shared size class

`07-signs-drill.html` scales `.sign--xl` inside `.stage` only:
`width: clamp(150px, 48vw, 216px)`. `_base.css`/`_signs.js` are untouched. The
drill sign has to dominate a 390px viewport; 148px does not. If this reads as
correct, consider a `.sign--hero` size in the shared layer instead.

---

## 2026-08-11 — Study session and exam flow (mockups 03, 04a, 04b, 05, 06a, 06b, 06c)

Nothing in `_base.css`, `_signs.js`, or the grounding was edited.

### BLOCKING — `_base.css` semantic text colours fail the committed AA baseline

§5 commits to WCAG 2.2 AA (≥4.5:1 for text) and §8 commits to Lighthouse
Accessibility = 100. Two shared classes cannot meet that as written. Measured
with the WCAG 2.x relative-luminance formula:

| Foreground | On surface | Ratio | Where it is used | Verdict |
|---|---|---|---|---|
| `--guide-lit` `#0A8F6C` | `.choice--correct` bg `#172D2D` | **3.53:1** | `.verdict--ok` (12px bold) | fail |
| `--guide-lit` | `--asphalt-raised` `#1C1F25` | **4.05:1** | `.eyebrow--guide` in a panel | fail |
| `--guide-lit` | `--asphalt` `#14161A` | **4.49:1** | `.eyebrow--guide` on page | fail (marginal) |
| `--stop-lit` `#D8232A` | `.choice--wrong` bg `#371D23` | **3.07:1** | `.verdict--bad` (12px bold) | fail |
| `--stop-lit` | `--asphalt-raised` | **3.30:1** | `.verdict--bad` in a panel | fail |
| `--stop-lit` | `--asphalt` | **3.64:1** | `.eyebrow--stop` | fail |
| `--sign-faint` `#6B7280` | `--asphalt` | **3.74:1** | `.faint` (12px) — used in the exemplar too | fail |

`--warning` on asphalt is 12.1:1 and `--sign-dim` is 7.2:1; both are fine.

This is load-bearing for this product specifically: correct/incorrect is the
whole job of `.verdict`, and §5 names a red/green-colourblind learner as squarely
in the audience.

**Recommended fix — add text-only tokens; do not touch the sign colours.** §2's
rule that "a sign uses its real MUTCD colour" governs *sign faces*, not UI text,
so this costs nothing semantically:

```css
--guide-text: #2FBF95;   /* 7.1:1 on --asphalt-raised */
--stop-text:  #FF6B70;   /* 6.6:1 on --asphalt */
--sign-faint: #808894;   /* 4.6:1 on --asphalt */
```

…then point `.verdict--ok`, `.verdict--bad`, `.eyebrow--guide`, `.eyebrow--stop`
and `.faint` at them. Sign faces keep `#04684E` / `#B4151C` untouched.

These seven mockups use the shared classes **as authored** rather than patching
around the defect locally, so it stays visible. New CSS written for these pages
(e.g. the exam strike counter) already avoids the failing pairs.

### Missing primitives — focus-mode chrome

§4 makes the study session and exam simulator full-screen focus modes, but
`_base.css` has no vocabulary for that mode, so four files carry near-identical
page CSS:

- **`.focusbar`** — sticky top bar holding exit, `MileMarker`, `ProgressRail`. In `03`, `04a`, `04b`, `05`.
- **`.exit`** — the quiet, uppercase, 44px-tall exit affordance inside it.
- **`.actionbar`** — sticky bottom action shelf standing in for the hidden nav. In `04a`, `04b`, `05`.
- **Body reset** — `_base.css` hardcodes `body { padding-bottom: 92px }` and
  `padding-left: 232px` @1024px to reserve nav space, so every focus-mode file
  has to undo both. Suggest a `body.focus` or a `.shell` wrapper owning the nav
  offset instead of `body`.

Suggested §3 addition: **`FocusChrome`** (focus bar + action shelf), replacing the
four copies.

### Missing state — `ChoiceRow` has no "selected, not yet judged"

`ChoiceRow` is specified with correct/incorrect/neutral. The exam simulator needs
a fourth: **selected, verdict withheld**. `.choice--muted` means de-emphasised;
`--correct`/`--wrong` leak the answer.

`05` implements it as a deliberately achromatic treatment keyed off
`aria-pressed="true"` — white border, 8% white fill, inverted key — so selection
carries no colour semantics at all. Recommend promoting it, keeping the
`aria-pressed` hook rather than a class, since the state is then unforgeable.

### `TopicMeter` has a head but no bar

`_base.css` defines `.meter`, `.meter__head`, `.meter__name`, `.meter__val` and
stops. The three score reports pair `.meter__head` with a `.rail` and mark the
rail `aria-hidden="true"` because the head already states "3 / 6" in text.
Recommend freezing that pairing, including the threshold rule used here:
≥80% guide green, 50–79% `.rail--warn`, <50% `.rail--stop`.

### Missing primitives — exam pressure instruments

- **`Timer`** is listed in §3 but has no CSS. Implemented as `.timer` /
  `.timer__val` (Overpass Mono, tabular, 20px) / `.timer__lab`.
- **Strike counter** — the TN early-termination rule (7 wrong ends it) needs a
  persistent, glanceable "2 of 7 wrong". Implemented as `.strikes`: seven pips
  plus a text count. No listed component covers it; suggest `StrikeCounter`.

### Missing primitive — the verdict sign

The score reports render the result as a sign face rather than a heading: guide
green for a pass ("you may proceed"), a white regulatory face with a red legend
for falling short ("this is the rule"), and `#sg-stop` at `sign--xl` for early
termination. Implemented as `.plaque` / `__face` / `__legend` / `__score` /
`__verdict`, duplicated between `06a` and `06b` with different colouring.
Recommend a **`VerdictSign`** with `pass | short | halted` variants — it is the
signature moment of the exam flow and should not be three copies of page CSS.

### `#sg-guide` cannot use the square `.sign--*` sizes

`#sg-guide` carries a `140 × 100` viewBox while `.sign`, `.sign--sm/lg/xl` are
square, so it letterboxes to a thin green bar. `.sign--wide` sets `width: 132px`
with no matching height. `06a` dropped a planned use of it for this reason.

### Content note

TN rules asserted across these seven files, for verification against the manual:
30 questions, 24 correct to pass, seven wrong ends the attempt; school-bus stop
required in both directions where a centre turn lane rather than a physical
barrier or unpaved median separates the roadway; implied-consent refusal costs
one year of driving privileges on a first refusal. Citations use the frozen shape
`Tennessee Comprehensive Driver License Manual · Section: X · p. N`; the page
numbers and the quoted wording are placeholders pending
`docs/research/manual-spine.md`.

---

## 2026-08-11 — Progress, settings, and the two long-content cells (mockups 09, 09b, 09c, 11, 11b, 03b, 06d)

Nothing in `_base.css`, `_signs.js`, or the grounding was edited.

### Charts exist in the grounding but not in the component vocabulary

§1 rules that charts are hand-authored inline SVG with no library. §3's component
list has no chart in it at all, so cells 9, 9-empty and 9-long-content had nothing
to reach for. Two are needed, and both are built from roadway vocabulary rather
than generic chart furniture:

| Component | What it is | Why the existing list can't carry it |
|---|---|---|
| `ReadinessRoad` | The readiness time series drawn as a road: a light carriageway stroke with a dashed `--warning` centre line, a `--guide` sign tab hung at the 80% pass mark, and diamond markers on mock exams (filled = passed, hollow = not). | `ProgressRail` is a single-value bar. Nothing plots a series, and a generic line chart would break §2's "not generic-looking" clause. |
| `BlueprintLanes` | Accuracy per exam area as four lanes of one road, lane stripes between them, a dashed target line at 80% drawn across all four. | `TopicMeter` handles one topic at a time and cannot show the four areas against a shared target — which is the whole point, since the manual weights them 25% each. |
| `AttemptTrace` | The history list as a dashed centre line running down the page with one node per attempt (guide / stop / neutral) and a score chip. | `RelatedQuestionRow` is a single past question; nothing renders an ordered log of sessions. |
| `SwitchRow` / `SegmentedField` | The two settings controls: `role="switch"` with its state written in words, and a real radio group styled as a segment. | §3 has no form control of any kind. Settings cannot exist without them. |
| `CorrectionCard` | Manual-said / we-teach pair, effective date, reason, and source line, tagged in construction orange. | This is the §7 "override must be visible to the learner" requirement made into a surface. `ExplanationBlock` cites the manual; it has no vocabulary for the manual being *wrong*. |
| `Ledger` (in `Dialog`) | The lose / keep two-column ledger inside the reset confirmation. | `Dialog` is a shell. Spelling out what a destructive action costs is the substance of that screen, and it recurs nowhere else. |

### Chart accessibility — the pattern these three files freeze

§5 forbids colour as sole carrier, and charts are where that usually fails.
The frozen pattern is: `role="img"` with `<title>` + `<desc>` naming the actual
figures; every under-target bar **hatched** as well as coloured; mock exams a
different **shape**, not a different colour; a shape-swatch legend rather than a
colour key; and a `.sr-only` data table (or, at 57 points, a visible `<details>`
list) carrying every value. A build that ships the charts without the table is
not equivalent to these mockups.

### Text colour — resolved upstream, with one gap left

The BLOCKING contrast defect logged in the previous section has since been fixed
in `_base.css`: `--guide-text`, `--stop-text`, `--work-text` now exist and
`--sign-faint` was corrected to `#808894`. **All seven of these files use those
shared tokens; none is redefined locally.**

One text-safe colour is still missing. `--route-lit` `#2C6FC4` measures
**3.28:1** on `--asphalt-raised` — correct as a border or an icon, short of AA as
text. `09b` and `11` both need interstate blue as small text (the informational
panel eyebrow, the "restore from a file" link), so each declares one *new*
page-level variable:

```css
:root { --route-text: #6BA6F5; }   /* 7.3:1 on --asphalt */
```

**Recommend adding `--route-text` to `_base.css`** beside the other three, and
pointing a `.eyebrow--route` at it.

Also unresolved: `#fff` on `--guide-lit` is **4.07:1**, so the shared
`.choice__key` on a correct answer is a hair under AA. `06d`'s own answer keys
use the deeper `--guide` / `--stop` faces (6.8:1 and 6.9:1) instead — which is
what a real sign does anyway. **Recommend the same change to `.choice__key`.**

### `.sr-only` again

The previous section recommended promoting `.sr-only` into `_base.css`. It has
since landed there, and these files use it for the chart data tables. Noted as
resolved.

### Numbering inside the score report

§2 permits `01/02/03` numbering "only in the exam simulator and study session".
`06d` numbers all thirty reviewed questions `01`–`30`. Reading that as the exam
simulator's own report — the order is genuinely real, it is the order the
questions were asked in — but flagging it in case the intent was narrower.

### Cell 11-error is only half covered

Matrix note 17 defines the settings error cell as "the destructive reset
confirmation **and its failure path**". `11b` is the confirmation. The failure
path — erase blocked by private browsing or locked storage, partial erase,
"nothing was deleted" — has no mockup in this set. `11b` states the promise in
its footnote, but **the failure screen itself is an open gap** and needs an `11c`.

### Content deviations

- **Two personas, deliberately.** `09` continues the exemplar's learner exactly
  (readiness 72, 248 answered, weak topics 36/46/53/58, and today's 21/30 exam
  matching `06b`). `09c` is that same learner eleven weeks later — 57 attempts,
  612 answered, readiness 84 — because the long-history cell has to show a volume
  the exemplar's learner has not reached. Numbers are internally consistent within
  each file: readiness *is* overall accuracy, and the four blueprint areas sum to
  the answered total.
- **`11` and `11b` are set on the `09c` persona** (57 attempts / 612 answers), so
  the reset dialog can state real quantities.
- **Correction dates.** The Move Over expansion is stated as "in force 2023"
  rather than a precise day, and the aggravated-BAC change as "since 2022
  amendment", because the exact effective dates were not verified. The build must
  pin real dates from `docs/research/live-facts.md` before these strings ship —
  a settings page that discloses corrections cannot be vague about when.
- **Manual quotations remain illustrative**, per the earlier ratification: the
  `03b` Move Over passage and the `06d` citations freeze the format, not the text.
- **Three options everywhere.** `03b` and all thirty items in `06d` use A/B/C, per
  §7. Re-checked `03`, `04a`, `04b` and `05` at the time of writing: all four are
  now three-option too, so the set is internally consistent on the exam format.
  No combination distractor ("Both A and B") was needed in these two files.
- **The matrix's own long-content note is stale.** Note 9 specifies "the longest
  real question stem + **four** long choices". That predates the §7 three-option
  ruling, which is binding. `03b` uses three long choices. **Recommend correcting
  note 9** so a critic reading the matrix does not reject the file for obeying the
  grounding.

---

## Phase 2 — two form controls §3 does not yet have (OPEN)

Filed while fixing the blind critic's Phase 2 findings on `01-onboarding.html`
and `11b-settings-reset-confirm.html`. §3 says builders may use **only** the
listed components, and its vocabulary contains no date entry and no checkbox.
Both screens were therefore standing on raw browser form controls, which is
exactly the "reads as a default" failure the bar exists to catch: a native
`<input type="date">` renders a calendar glyph on both edges plus a locale
mask in Chrome and something else entirely in Safari, and a native checkbox is
a white system square — on the destructive-reset gate, the single
highest-stakes control in the product. Neither can be made cohesive across the
build, so neither is a styling problem; they are missing components.

### `DateField` — proposed for §3

Segmented **month / day / year**, three numeric text inputs in a single sunk
field with the calendar mark as a static leading glyph. Each segment carries
its own visible `<label>` (`Month` · `Day` · `Year`), so every field is
programmatically labelled; the whole group sits inside the existing `<fieldset>`
whose `<legend>` asks the question. Values set in Overpass Mono with tabular
figures, boxes on `--asphalt-raised` inside `--asphalt-sunk`, separators in
`--sign-faint`. Keyboard operation is ordinary tabbing and typing, and focus is
the shared yellow ring from `_base.css` — nothing is overridden. Renders
identically on every browser and OS because nothing about it is native.

*Behaviour the build owns, not the mockup:* auto-advance between segments,
paste of a whole date, clamping, and an `aria-live` echo of the resolved date
("Saturday, September 12, 2026") next to the pacing line.

### `ConfirmGate` — proposed for §3

The acknowledgement half of a two-step destructive confirmation: a real
`<input type="checkbox">` — real semantics, real keyboard operation, real
`<label for>` association — with `appearance: none` and a 24px box drawn from
`--asphalt-raised` / `--shoulder-lit`, filling to `--stop` with a white tick
when checked. It is deliberately **not** a styled `div` with `role="checkbox"`:
the gate on erasing 14 weeks of a learner's work is the last place to
hand-roll a control's semantics. The tick is a shape, not only a colour
change, so the state survives §5's "colour is never the sole carrier". The
second step — the `aria-disabled` danger button and its hint — is unchanged.

**Ruling requested:** add both to the §3 list. If either is refused, the two
screens need a different answer, because the raw controls are not acceptable
and §3 does not currently permit a replacement.

### Header pattern applied to `02f`, `08`, `08b`, `08c`, `10`

Not a deviation, recorded so the rest of the set can be brought in line: the
desktop headers had drifted into four different shapes. Settled on the one
`02f` already implied — `AppBar = [optional back-link] · page title · context
line — offline badge`, with the brand rendered **only** by `AppNav` at the head
of the side rail (§3), never in the page header. The context line hides below
900px, where the title and badge need the full bar. `09`, `06b`, `06d`, `11`,
`11b` still need the same treatment.

---

## 2026-08-11 — P1 foundation & design system (OPEN)

Nothing in `stack-grounding.md`, `executable-floor.md`, `practices-checklist.md`
or `mockups/_base.css` was edited. Three items to rule on.

### Two components added to the §3 vocabulary — ruling requested

§3 says builders may use **only** the listed components, and that adding one
means adding it there first via a deviation. Two were unavoidable:

| Component | What it is | Why the list can't carry it |
|---|---|---|
| `AppBar` | The §3 app-bar pattern made into a component: `[optional back-link · page title · context line] —— offline badge`, with the context line hidden below 900px. | §3 **specifies** this pattern and names no component that renders it. Leaving it uncomponentised means every one of the ~11 screens re-implements a frozen pattern by hand, which is exactly how the Phase-1 headers drifted into four different shapes. It renders `OfflineBadge`; it never renders the brand. |
| `ToastDock` | The fixed positioner a `Toast` sits in — offset clear of the bottom bar below 1024px and of the side rail above it. | `Toast` is the notice. Something has to own the offset, and §3's rule that no page undoes a nav offset means it cannot be the page. |

Both are ~25 lines and add no new visual vocabulary. If either is refused, the
pattern has to live in every page instead.

### `npm run audit` and `npm run audit:signs` are declared, not implemented

Both exit 0 printing `NOT YET IMPLEMENTED — this is not a pass`, the owning
piece (P9/P10 for Lighthouse, P3 for the sign audit) and the checks they will
perform. The scripts exist so `npm run verify` has its full shape from the
start; they are deliberately loud so a critic never reads silence as a pass.
`validate:content` is P2's and is left untouched.

### Playwright's dev server runs on 5301 / 5302, not 5173

`npm run dev` keeps port 5173 per §9. The two Playwright configs start their own
Vite on dedicated ports because a test harness that reuses "whatever is already
answering on 5173" will silently test a different application — which happened
once during this build, on this machine. The e2e and a11y suites are
self-contained as a result; nothing about the app's own port changed.

---

## 2026-08-11 — P2 (content pipeline & question bank)

### `practices-checklist.md` D9 cites the exam blueprint at PDF p.31; it is on PDF p.35

D9 says "Manual, PDF p.31 (`tn-dl-manual-extract.txt` line 2413–2421)". The line
numbers are right and the page number is not: lines 2413–2421 sit under
`===== PAGE 35 =====`, which is printed page 21 (Chapter A-4, "The
Examinations"). The blueprint quote used by `taxonomy.json` therefore cites
**pdfPage 35 / printedPage 21**, and the validator checks that quote verbatim.
No content changed — only the page label. Recording it so a critic checking
D16 (PDF vs printed page discipline) does not read the mismatch as our error.

### 15 of the 548 spine rules carry no verbatim-matchable quote and are unused

`scripts/extract-rules.mjs` verifies every quote in `manual-spine.md` §2 against
the extract before writing `src/content/rules.json`, and drops the ones that do
not match: 533 of 548 survive. The 15 dropped are all cases where the PDF
hyphenates a word across a line break (`right-\nof-way`, `two-\nway`) and the
spine reproduces the joined form. Normalizing that away would mean adding
de-hyphenation to the matching rule in `executable-floor.md` §3, which is
frozen, so instead those rules are simply not cited — every affected topic is
covered by a different rule or by an inline quote that does match. Affected:
R007, R054, R145, R152, R163, R211, R214, R269, R286, R298, R310, R400, R470,
R479, R543.

### The sign registry holds signs, not channelizing devices

`executable-floor.md` §3b makes a MUTCD designation mandatory — "a sign with no
MUTCD designation fails the build". Cones, drums, vertical panels, concrete
barriers, flagger flags, high-visibility vests, traffic-signal heads and
pavement markings have no sign designation because they are not signs, so they
are **not** in `signs.json` (87 entries, all with designations verified against
the FHWA 2009 MUTCD chapter texts). They remain fully taught: eleven questions
in the `work-zone-signs` topic and twelve in `pavement-markings` cover them from
the manual's prose. If P3/P6 want them rendered, they need a separate
`devices` collection with its own audit rules rather than a fake designation.

### Questions are authored against rule ids and assembled by a build step

`src/content/authoring/*.json` holds the human-written part (stem, options,
keyed answer, explanation) and references the manual by rule id;
`scripts/build-questions.mjs` resolves each id into the full citation and writes
`src/content/questions.json`. Both are committed. This exists so no quote is
ever retyped by hand — the single largest source of a fabricated citation — and
so a citation cannot drift from the text it came from. The build step also
rotates option order by a hash of the question id, because questions authored
with the correct answer first would otherwise ship a "the answer is always A"
tell; the 27 official questions are never rotated.

## 2026-08-11 — content round 2 (citation-support audit)

### Curb-colour questions removed; the mapping is now never-generate

`prk-013` (red curb) and `prk-014` (white curb) are gone from the bank and
`curb-color-meanings` is on the never-generate list. PDF p.80 says "The colors
on the curbs mean:" and then prints three unlabelled numbered meanings; the
words WHITE, YELLOW and RED are artwork swatches beside the list and land at the
very end of the page in the text layer, detached from the items they label.
Nothing in the extract binds a colour to a meaning, so both questions cited the
same three-item quote and that quote supported all three options equally — each
question's distractors were literally the other two items. The manual's only
prose sentence about curb colour (p.79, "Signs or yellow painted curbs usually
mark a 'NO PARKING ZONE'") contradicts the p.80 yellow item, which makes a
positional guess worse rather than better. No mapping was invented. The topic
`parking-and-backing` still ships 20 questions against a floor of 10, so no
backfill was needed.

### Citations are now page-exact, and no shipped quote straddles a page break

`quoteIsOnPage` used to accept `pdfPage` **or** `pdfPage + 1`, which blessed
every off-by-one citation. It is now exact (`scripts/lib/page-locator.mjs`),
with one narrow exception: a match that *begins* on the cited page and *ends* on
the next one. A quote living wholly on the next page is a wrong page number and
fails. Three citations and one sign entry were one page early and were corrected
(`lit-010`, `ngt-010`, `wzn-007`, `g20-2-end-road-work`).

In practice the exception never fires on this extract, because the printed page
number is the first token of every page's text layer and therefore interrupts
any sentence that runs across the break. The p.88/89 sentence "When parking at
night, never leave your headlights on, even if | you plan on being parked for a
brief period of time…" is therefore cited as two page-exact halves rather than
one straddling quote. The exception is proved by unit test against a synthetic
page index in `src/content/validate-content.test.ts`.

### `rules.json` R376 records PDF p.88 for a quote that is on p.89

`src/content/rules.json` is generated by `scripts/extract-rules.mjs` from
`docs/research/manual-spine.md`, which this piece does not own. R376's quote
("Whenever you park on or along a highway at night…") is on PDF p.89, not the
p.88 the spine records. Rather than hand-edit generated data, the affected
citation carries a per-citation `pdfPage` override (`{ "ruleId": "R376",
"pdfPage": 89 }`). The spine entry should be corrected at source when
`manual-spine.md` is next touched.

### Three option texts were corrected to what the manual actually says

- `emg-012` (rumble stripes) keyed "Alert a driver who is drifting off the road,
  and improve wet-night visibility". The manual (p.90) says the vibration and
  noise are a *secondary* effect and the primary function is wet-night
  visibility; it never says rumble stripes alert a drifting driver. The option
  now states the manual's own ordering.
- `alc-052` (restricted licence after DUI) keyed an option ending "and required
  program appointments". The p.100 sentence listing the permitted trips is cut
  off by the page break and never completes in the extract, so that clause had
  no source. The option now stops at "work, full-time college and religious
  services", all of which are verbatim.
- `fol-005` keyed "Two thirds of a second"; the manual writes "2/3 of a second".
  The option now uses the manual's own form.
---

## 2026-08-11 — P4 (study session & adaptive engine)

Nothing in `stack-grounding.md`, `executable-floor.md`, `practices-checklist.md`,
`state-matrix.md` or `mockups/` was edited. Nine items to record; the first
three want a ruling.

### 1. A `work` panel variant, and three page-level layouts — ruling requested

§3 enumerates the panel variants as `guide / stop / warn / route`. Mockup `03b`
puts the corrections notice in **construction orange**, which §2 defines as
"content that moved / in progress" — exactly what a post-2022 correction is.
Warning yellow is already spoken for ("caution / review this"), and reusing it
would make a correction look like a weak topic. So `SignPanel` gained a `work`
variant (`.panel--work`, four lines of CSS).

Three layouts were also transcribed from the ratified mockups into
`src/styles/components.css`: `.changed` (the corrections notice, `03b`),
`.lookup` (the opt-in "look it up in the manual" `<details>`, `03b`) and
`.again` (the "queued again" diamond panel, `04b`). **No new component was added
to `src/components/`** — these are compositions of `SignPanel` and a native
`<details>`, and they live under `src/routes/study/`. The mockups that specify
them are already ratified, so this is recorded rather than proposed; the panel
variant is the only genuine widening of §3.

### 2. `zustand` was installed; `src/store/` is the store convention

Grounding §1 names `zustand` + `persist` as the state decision, but P1 shipped
without the dependency, so P4 added it (5.0.14, one package, ~1 KB gzipped).
The convention P5–P8 should follow: **every state transition is a pure function
in `src/domain/`; `src/store/` holds a thin `persist`ed store that calls them.**
`persist`'s own serializer is deliberately replaced with the domain's
(`serializeProgress` / `loadProgress`), so the code a critic exercises by
writing garbage into `localStorage` is the code that actually runs (X19/X20).

### 3. `.gitattributes` — a pre-existing `npm test` failure on Windows

`npm test` failed on a clean checkout of `content/p2-question-bank` on this
machine **before any P4 code existed**: `src/content/validate-content.test.ts`
asserts the extract contains a literal `considerably more\nhazardous`, and
`core.autocrlf=true` had checked that file out with CRLF. Fixed at the repo
level by pinning `docs/research/**` and `src/content/**` to `eol=lf` and
re-checking-out those paths. **No file under `src/content/` or `scripts/` was
edited** — only their line endings, which the index already stored as LF. Filed
here because the fix touches P2's territory even though it is not P2's bug, and
because a critic on Windows would otherwise inherit a red suite.

### 4. The interval policy is a fixed six-box ladder, not SM-2

10 minutes · 1 day · 1 week · 2 weeks · 1 month · 3 months; one box up per
correct answer, straight back to box 0 on a miss, graduating at three in a row.
The full rationale is in the module header of `src/domain/scheduler.ts`. The
short version: the learner's horizon is weeks, a per-card ease factor changes
almost no decision over ~500 items in that window, and the app **states the
schedule to the learner in words** ("in about ten minutes, then tomorrow, then
next week") — a promise only a fixed ladder can keep honestly. The wording on
the answer-revealed screens is generated from the ladder itself, so the copy
cannot drift from the behaviour.

### 5. `/study/session` accepts `?seed=`, `?n=` and `?q=`

`?seed=` pins the adaptive draw, `?n=` the session length, `?q=id,id` an exact
line-up. They exist so a state-matrix cell is reachable deterministically —
**the long-content cell is `/study/session?q=int-016`**, the longest real item
in the bank (long stem, three long options, a 337-character verbatim quote) and
one that also carries a post-2022 correction. `?q=` is likewise the hook a
"practise this rule" link from the rule reference will use.

### 6. The `StudyRoute` page gained a "Start a session" panel

`/study` is P7's dashboard and is still P1's placeholder. Without an entry point
the session is unreachable, so P4 added one guide panel with a button, inside
the existing `Placeholder`, and changed its `owner` note to say P7 absorbs it.

### 7. `CitationLink` is deliberately not rendered in the explanation

`ExplanationBlock` renders a `CitationLink` when its citation carries a `to`.
P4 omits it: the rule-reference route (`/rules/:id`) is P8's and does not exist,
and a link that 404s is worse than no link. P8 should pass `to` through — every
citation already carries its `ruleId`.

### 8. A session-completion screen exists, and is not in the mockup set

Cell 4 has no "session over" variant, but a twelve-question session has to end
somewhere. It is a short panel inside the same focus chrome — score, weakest
topics, back to Study. It is deliberately **not** a score report: the plaque,
the pass/fail verdict signs and the review list are P5's.

### 9. Note for whoever drives this with Playwright

The split route's `HydrateFallback` (P1's `RouteFallback`) renders a
visually-hidden `<h1>Loading</h1>`, so `getByRole('heading', { level: 1 })`
resolves *before* the session mounts and any key press is then delivered to the
fallback. Wait on `.stem` or `.choice`, as `tests/e2e/study.spec.ts` does.

---

## 2026-08-11 — P5 (exam simulator & score reports)

Nothing in `stack-grounding.md`, `executable-floor.md`, `practices-checklist.md`,
`state-matrix.md` or `mockups/` was edited, and nothing under `src/content/` or
`scripts/` was touched. Twelve items to record; the first wants a ruling.

### 1. Mockups `06b` and `06d` show a score the seven-wrong rule forbids — ruling requested

`06b` reports **21 / 30 with 9 wrong**, and `06d` reviews **30 questions with 9
missed**. Under the rule this bar calls binding, neither is reachable: the
attempt ends on the **seventh** wrong answer, so no sitting can record eight or
nine misses.

The arithmetic underneath is worth stating, because it shapes all three
reports: a sitting that reaches all 30 questions with six wrong or fewer *is*
24 correct, and a seventh wrong ends it. **A completed 30-question exam can
therefore only pass or halt.** "Fell short" is real, but it is reached by
running out of the hour or by walking out — which is exactly what the real test
does to you, and exactly what mockup `05`'s own exit dialog describes ("Ending
now scores what you've answered — 9 correct out of 30").

The build honours the rule and keeps `06b`'s layout, voice and structure at
intent parity: the same white regulatory plaque, the same "Three short"
headline (computed as `24 − correct`), the same tiles, the same "what sank it"
meters and the same fix-it panel. It is reached by ending an attempt early or
by the hour running out. `tests/e2e/exam.spec.ts` drives it by answering 24
questions with three of them wrong and pressing "End exam" — 21 correct,
"Three short", which is `06b` with an honest set of numbers.

**Ruling wanted:** confirm that the rule outranks the mockup's illustrative
figures. If the mockups are instead the authority, the seven-wrong rule has to
be dropped — and that is the one cell the bar says a build must not omit.

### 2. Page-level layouts transcribed into `src/styles/components.css`

No new component was added to `src/components/`. The score report and the full
review are compositions of `VerdictSign`, `TopicMeter`, `SignPanel`, `StatTile`,
`StrikeCounter`, `Button` and `SegmentedField`; what the stylesheet gained is
the *layout* those mockups specify: `.rev` / `.ans` / `.k` / `.tagx` (one
reviewed question, `06d`), `.reviewbar` + `.jump` (the review's sticky filter
row, `06d`), `.halt` and `.strikeline` (`06c`), and the three-up
`.grid-tiles .panel` treatment (`06a`–`06c`). Recorded here for the same reason
P4 recorded `.changed` / `.lookup` / `.again`.

### 3. `FocusChrome` gained an optional `statusRow`

Mockup `05` puts the clock alone on the first bar row and the position plus the
strike counter on a second. `FocusChrome` had one row, and at 390px the exam's
four instruments wrapped into an unreadable block. The component now takes an
optional `statusRow` node rendered as a second row. **Purely additive** — the
prop is absent everywhere else, so the study session's chrome renders exactly
as P4 shipped it.

### 4. Exam attempts live in their own versioned key

`tn-drive:exams`, `schemaVersion: 1`, bounded to the most recent **200**
attempts (grounding §6), with the same envelope, migration and corruption
handling as the study record and its own unit tests. It is deliberately *not*
folded into `tn-drive:progress`: the two have different shapes, lifetimes and
bounds, and versioning them together would force a migration of a learner's
spaced-repetition ladder every time the exam record changed.

### 5. The attempt in progress is persisted, and the clock keeps running

The bar requires that browser-back is "never silently destructive". Guarding
the in-app navigation is not enough on its own — a reload or a crash would
still lose the attempt — so the open sitting is written to the store on every
answer and resumed on load. The deadline is absolute, so time spent away is
time spent: an attempt whose hour elapsed while the app was closed is scored as
a timeout and filed rather than silently dropped. That is what the real test
does, and it is disclosed on the briefing screen before the clock starts.

### 6. `makeRandom` / `shuffled` moved to `src/domain/random.ts`

Both were private to `src/domain/session.ts`, and the exam sampler needs the
same deterministic draw. They were moved rather than copied; `session.ts`
imports them and its behaviour and tests are unchanged.

### 7. A mock exam feeds the study record

Every exam answer is also recorded through `useProgressStore.answer`, so the
spaced-repetition ladder and the topic rollups learn from the exam and a missed
question comes back. Without it the fix-it session would be the only trace of a
30-question sitting, and the dashboard would claim the learner had done nothing.

### 8. The fix-it session is the questions you missed, by id

Mockups `06b` / `06c` label it "18 questions on the two weak topics". The build
links to `/study/session?q=<missed ids>` — the actual questions, in the order
they were missed, each returning with its rule and its manual page. It reuses
P4's `?q=` line-up rather than adding a second sampler, and it cannot drift
from what the report just said.

### 9. `/exam/run` accepts `?seed=`, and the question carries `data-qid`

`?seed=` pins the paper so a state-matrix cell is reachable twice over. The
question wrapper carries `data-qid` — the question's **id**, never its answer —
because an exam that reveals nothing about correctness cannot otherwise be
driven end to end by a test or a reviewer. The whole bank ships to the device
by design, so this exposes nothing that was not already there.

### 10. The exam question shows no topic line

The study session labels every question with its topic. Mockup `05` does not,
and neither does the build: naming the blueprint area on an exam question
narrows it, and the real test does not tell you which chapter it came from.

### 11. `ExamRoute` replaced P1's placeholder, and three routes were added

`/exam` is now the real entry point: the rules, the start button, a resume
button when an attempt is open, and a link to the last score report. The new
routes are `/exam/run` (focus mode, outside the shell), `/exam/report` and
`/exam/review`, all three code-split. All are static paths, so
`servablePaths()` keeps deriving the a11y sweep from the router.

### 12. Note for whoever drives this with Playwright

Same trap P4 recorded: the split route's `HydrateFallback` renders a hidden
`<h1>`, so wait on `.choice` / `.stem`, not on a heading. To reach the score
reports, press **Start the exam** first — the clock does not run until the
disclosure has been shown (practices A15).
