# Evidence Ledger

Per piece: rounds run, final verdict, and the paths to the evidence a **blind
critic** produced itself — screenshots of the real running app, verbatim
command output, audit results.

**No ledger entry, no done claim.** This file is the input to
verification-before-completion.

| Piece | Rounds | Verdict | Evidence |
|---|---|---|---|
| **P1 — Foundation & design system** | 2 | **PASS** (round 2) | Blind critic ran the full floor: typecheck/lint/build/test exit 0, 180 unit tests, `src/domain/` **100%** vs a 90% floor, initial JS 95.5 KB / 180 KB, **zero axe violations across 9 routes × 2 widths**, 42/42 tab stops with focus rings, reduced motion honored, zero third-party requests in dev and prod, tokens + type split transcribed faithfully. 41 screenshots in `evidence/critic-p1p2/`. Round 2 closed 3 defects — see below. |
| **P2 — Content pipeline & question bank** | 2 | **GAP → fixed, awaiting re-audit** | Round 1 critic found the fatal class: **10 questions whose citation did not support the keyed answer**, several where the quote argued for a distractor. Round 2 fixed all 10, widened 21 weak citations, and closed the class with a validator check. Not yet re-audited by a blind critic. |
| **P3 — Sign system** | 1 | **PASS (self-gated)** | 87/87 registry entries with hand-authored geometry; `npm run audit:signs` renders the real component in headless Chromium and measures every `<text>` bbox against the face path. `PASS — 87 signs drawn, 93 legends inside their faces, 0 failures.` Contact sheet: `artifacts/signs-contact-sheet.png`. **The gate caught 4 real legend-overflow defects on its first run** (R2-1, R6-2, R15-2P, W20-5). Not yet judged by an independent critic. |
| **P4 — Study session & adaptive engine** | 1 | **built, not yet judged** | 271 tests; `src/domain/` 100%/95.2%; 56 e2e incl. keyboard-only completion, live region, 320px + 200% zoom long content, X19/X20 corruption; 30 axe checks, zero violations. Evidence: `evidence/p4-study-question.png`, `p4-study-answered.png`. |
| **P5 — Exam simulator & score reports** | 1 | **built, not yet judged** | 375 tests; `src/domain/` 100%/94.5%; 88 e2e; 54 axe. 7-wrong termination tested behaviorally (all-wrong ends at Q7; misses at 1,2,3 then alternating ends at Q10); blueprint sampling verified over 200 seeded runs, every sitting 7–8 per area. Evidence: `evidence/p5-exam-entry.png`. **Exposed a logical contradiction in the frozen bar** — see the 2026-08-12 ruling in `deviations.md`. |
| **P6 — Sign trainer & library** | 1 | **built, not yet judged** | 472 tests; 164 e2e; 78 axe, zero violations; initial JS 126.3 KB / 180 KB. Drill accessible name asserted **equal to** shape+color across four seeds, so it cannot leak the answer. Evidence: `evidence/p6-signs-library.png`. **Found a pre-existing WCAG failure on `.btn--guide:hover`** (3.72:1 white-on-fill, primary action of every screen) and fixed it. |
| **P7 — Dashboard & onboarding** | — | **in progress** | Interrupted by a process restart; resumed from transcript with work intact in its worktree. |
| **P8 — Progress, settings & rule reference** | — | **in progress** | — |
| **P9 — Offline, PWA & resilience** | — | not started | — |
| **P10 — Practices & executable sweep** | — | not started | — |

### Round-2 fixes closed (evidence)

| Defect | Proof it is fixed |
|---|---|
| Bad content did not fail the build | Pointed `prebuild` at the broken fixture: `BUILD EXIT = 1`, and `grep -c "vite v"` → `0` — vite never ran. |
| `/gallery/focus` overflowed at 320px **and the reflow spec excluded that route** | Route list now derived by walking the router tree; it **throws** on a `:param` segment rather than silently skipping. Same pattern closed in the a11y spec: coverage 18 → 22 checks. |
| Two sign schemas disagreed (13 ids vs 87, two category vocabularies) | `signs.json` is sole source of truth; test asserts every geometry id and every content-referenced id resolves. |
| Citation quote did not support the keyed answer (10 questions) | New `citation-support` check: numeric contradiction, no-keyed-support, distractor-dominant. Flagged 19/508 before fixes, **0/506 after**. Four regression fixtures added. |
| `quoteIsOnPage` accepted `pdfPage` **and** `pdfPage+1` | Replaced with exact matching plus a proven page-straddle exception; 4 one-page-early citations found and fixed. |
| `rules.json` was generated and never page-checked | Swept all 533 (`scripts/audit-rule-pages.mjs`): every quote found, **6 cited the wrong page**, all corrected. Now **533/533 page-exact**. |

---

## Phase 1 — bar construction

| Artifact | Status | Evidence |
|---|---|---|
| Official manual retrieved | done | `https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf` — 12,033,456 bytes, 135 pages, `%PDF-1.6` |
| Manual text extracted | done | 135 pages / 558,652 chars via pdfjs-dist → `docs/research/tn-dl-manual-extract.txt`; reproducible via `scripts/extract-manual.mjs` |
| Manual spine compiled | done | `docs/research/manual-spine.md` — 127 section rows, **548 cited rules**, **132 signs**, **278 numbers**, **27 official sample questions verbatim** + answer key. Page mapping `printed = PDF − 14`. Quotes spot-verified against a whitespace-flattened source. |
| Live-fact verification | done | `docs/research/live-facts.md` — 58 facts (41 high-confidence, primary sources), conflict list vs. the 2022 manual, 11 open questions carried honestly |
| Wiki ingest | done | Vault `C:\Users\ehart\.wiki-master-vault` — clipping + 12 cross-linked pages (1 source, 1 entity, 10 concepts), catalog regenerated |
| `stack-grounding.md` | done | — |
| `state-matrix.md` | done | 11 screens × 7 states + 5 called-out variants |
| `practices-checklist.md` | done | 60 items (A1–F6) across a11y, security, resilience, content fidelity, stack idioms, PWA |
| `executable-floor.md` | done | 23 thresholds (X1–X23) |
| `mockups/_base.css`, `mockups/_signs.js` | done | shared token + MUTCD sign layer |
| `mockups/02-dashboard-populated.html` | done | `mockups/_shots/02-dashboard-populated.png` |

### Phase 1 findings that changed the bar before it froze

| # | Finding | Evidence | Outcome |
|---|---|---|---|
| 1 | **Exam blueprint is published by the manual itself** — 25% signs / 25% safe driving / 25% rules of the road / 25% drugs & alcohol, Sections B–C only | `tn-dl-manual-extract.txt` PDF p.31, lines 2413–2421, quoted verbatim in grounding §7 | Binding. Sampling by page count would over-weight rules of the road. Two research agents disagreed; resolved by reading the source directly. |
| 2 | **Real format is three options (A/B/C), not four** | Only 3 occurrences of a line-initial `D.` in 135 pages; all 8 "Chapter Sample Test Questions" sets are A/B/C | All study/exam/drill mockups corrected from 4 → 3 options. |
| 3 | **`_base.css` semantic text colors failed the committed AA baseline** — `--guide-lit` 4.45:1, `--stop-lit` 3.64:1, `--sign-faint` 3.74:1 | Measured by the study/exam mockup agent; luminance math independently re-derived by the lead | Text-only tokens added; sign faces keep true MUTCD color. Would have blocked the Lighthouse-100 budget on every screen. |
| 4 | **School signs were rendered fluorescent pink** — MUTCD school/ped/bike warning is fluorescent yellow-green; pink is incident management | Caught by the signs mockup agent | Sprite and tokens corrected. Would have taught a wrong fact in an app premised on sign accuracy. |
| 5 | **Verbatim quote matching is viable, and requires whitespace normalization** | Extract wraps lines mid-sentence (see p.65 school-bus rule spanning lines 5149–5157) | Normalization rule written into `executable-floor.md` §3 with a required regression test. |
| 6 | **A real citation demonstrated end-to-end** | `04b-study-incorrect.html` now carries the true verbatim p.65 text: *"…A turn lane in the middle of a four-lane highway is NOT considered a barrier…"* — and the rule the mockup teaches is confirmed correct against the manual | Proves practices D1/D2 are buildable rather than aspirational. |
| 7 | **The manual contradicts itself in four places** — Move Over Law lane threshold (pp.69 vs 86), renewal cycle 5-yr vs 8-yr, TDL fee arithmetic vs its own table, GDL fees across two tables | `manual-spine.md` caveats | Never-generate list required and validator-enforced (practices D15). Generating questions here would teach a coin flip. |
| 8 | **One sentence reads as permission but is a warning** — p.120's "Bicyclists may ride in the middle of the street and disregard stop signs and traffic signals" describes child behavior and contradicts p.119 | `manual-spine.md` | Added to the never-generate list. This is the single most dangerous sentence in the source to quote out of context. |
| 9 | **The manual states no insurance dollar amounts at all** | `manual-spine.md` "topics absent" | Corrected practices D10 — the 25/50/25 figures are real law but are *not* a correction to manual text, and must not be presented as one. Also confirmed absent: helmet law, open-container law. |
| 10 | **Sign artwork is not in the PDF text layer**; ~9 signs exist only as captions, and official sample question 7 is unanswerable from text alone | `manual-spine.md` sign caveats | The hand-authored-SVG approach is unaffected — but practices D17/D18 now forbid inventing meanings for those 9 and require question 7 to be paired with a rendered sign or excluded. |
| 11 | **Official answer-key bias:** all 27 sample questions are 3-option A/B/C, and a "both/all of the above" style answer is correct in 9 of 27 | `manual-spine.md` | Recorded so the generated bank does not inherit the artifact as a tell. |

### Mockup mini-gauntlet — round 1

Blind critic rendered all 28 mockups at 390×1800, six at 320×1400, eight at
1440×1000, plus geometry probes and zoom crops. Verdict: **GAP**.

| Severity | Finding | Resolution |
|---|---|---|
| critical | **8px caption overlap on the primary CTA across 8 files.** Lead-authored `margin:-.5rem 0 0` *replaces* the `.stack` margin instead of tightening it. Worst on `02b-dashboard-empty`, where the only secondary action was half-occluded | Fixed in all 8 files |
| critical | **Score reports invented 5 categories and omitted "Drugs and alcohol" entirely** — a quarter of the real exam — while `06d`/`09`/`11` used the correct four. `06b` and `06d` depicted the *same attempt* with incompatible numbers | Rewritten to the four blueprint areas; `06d` made source of truth; per-area counts reconciled to 21/30 |
| major | `06d` set 39 explanation blocks in Overpass 14–15px, breaking the frozen Newsreader ≥17px/1.6 reading rule | All 39 moved to `.read` |
| major | **Two signs render illegibly** — `ONE WAY` as "◄─NE WA", crossbuck cut at both blade ends; No Passing Zone drawn as a plain triangle rather than a W14-3 pennant | Sprite geometry rewritten; legends now read along the crossbuck blades |
| major | TopicMeter bands contradicted between files (53/54/58% painted red; 50% painted red) | Bands enforced ≥80 guide / 50–79 warn / <50 stop |
| major | Content lost at 320px in `09c` — "4/10" truncated, "ANSWERED"→"ANSWERE" | Reflow fix |
| major | Chart pass/fail marks distinguished by fill colour alone | Shape now carries outcome |
| minor | **In-app "Add to home screen" button cannot work on iOS Safari** — no `beforeinstallprompt`, and an iPhone is the design target | Platform-branched Share-sheet variant spec'd |
| minor | `11b`/`11c` contradicted on attempt counts; desktop rail brand block empty on 7 files; 3 different focus-mode exit glyphs | All reconciled |

Evidence: `mockups/_shots/` — 28 × `<name>.png`, 6 × `@320.png`, 8 × `@1440.png`,
scroll continuations, and zoom crops (`zoom-cta-overlap-02.png`,
`zoom-02b-overlap.png`, `zoom-oneway.png`, `zoom-crossbuck.png`, …).

### Mockup mini-gauntlet — rounds 2 and 3

**Round 2 — GAP.** Critical: `#sg-rr-advance` drew a `+` where MUTCD W10-1 is an
`X`, while the app's own question text on the same screen read *"a black X and two
R's"*; `#sg-donotenter` was composed as the European no-entry sign. Major: five
sign legends escaped their faces; a CSS specificity regression made
`.choice[aria-pressed]` outrank `.choice--correct`, so a **correct** answer
rendered achromatic; data contradictions across screens (a topic showing 8/12
against a total of 4/11); British spellings in a Tennessee app.

**Round 3 — GAP.** Critical: `#sg-yield` was **inverted** — red field with white
legend, where R1-2 is a white triangle with a red border and red legend. Major:
11 WCAG AA text-contrast failures surviving in token *usages* after the token
values were fixed (`.btn--danger`, `.badge--live`, `.shield--locked`'s hardcoded
`#6B7280`, `--route-lit` links); the 22-vs-84 registry fix was only half applied.

**Round 3 disposition — closed without a round 4.** Fixed: the YIELD inversion,
all 11 contrast usages, the white-on-white speed-limit legend in the color key,
six warning diamonds missing their black border, the W14-3 border scaled about a
non-centroid, and the W1-2 curve drawn as a W1-1 right-angle turn.

**Carried into Phase 2 as known items** rather than fixed in throwaway art: the
deer and work-zone figure quality, the `09` vs `09c` history reconciliation, the
`06c` app-bar deviation, and `02e` depicting both install branches at once.
Rationale: the mockup sprite is a 22-sign subset that **does not ship** — the
build authors its own ≥80-sign registry — so further rounds were polishing art
with no downstream consumer.

**Structural response (the important outcome).** Three factual sign errors in
three rounds, each caught only by chance inspection, means review is not a
control for sign correctness. Added `executable-floor.md` §3b — `npm run
audit:signs`, a build gate requiring an MUTCD designation per sign, declared-color
assertion, legend-containment assertion, and accessible-name assertion. Any one of
those checks would have caught all three errors automatically.
