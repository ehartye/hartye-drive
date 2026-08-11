# Bar: An offline-first Tennessee Class D knowledge-test study app that teaches the material — with a citation behind every answer — well enough that a learner walks into the Driver Service Center already knowing they'll pass.

**Created:** 2026-08-11
**Ratified-by:** assumed (user authorized proceeding without approval: *"ground yourself in research, clip, ingest quality content, don't wait on me to approve"*)
**Budget:** 3 rounds per piece · escalate on a 2-round stall · ~60 agent
invocations total across Phase 2 · honest partial report if exhausted

**Status:** **FROZEN 2026-08-11** after three mockup mini-gauntlet rounds.
Builders may not renegotiate any item. Disputes go to `deviations.md`.

**Known open items carried into Phase 2** (stated, not hidden — see `ledger.md`):
the deer and work-zone sign figures are low quality in the mockup sprite; `09`
and `09c` present irreconcilable histories of the same learner; `06c` deviates
from the app-bar pattern; `02e` depicts both install branches on one screen. None
block the build. The mockup sprite is a **22-sign subset that does not ship** —
the built registry is authored from `manual-spine.md` + MUTCD designations and
gated by `npm run audit:signs`.

---

## Assumptions made without approval (stated explicitly, per the headless rule)

These were chosen by the lead and are part of the frozen bar. Any of them is a
legitimate thing for the human to overturn at a checkpoint — but not by a
builder mid-loop.

1. **Scope** — Class D knowledge test, with road signs as a separate first-class study mode. Not Class M, not CDL.
2. **Platform** — installable offline-first PWA (React + Vite + TypeScript), static hosting, no server, no account.
3. **Content grounding** — derived from the official *Tennessee Comprehensive Driver License Manual*, with a page-level citation and a verbatim supporting quote on **every** question. The manual publishes its own exam blueprint (25% signs / 25% safe driving / 25% rules of the road / 25% drugs and alcohol, Sections B–C only) and uses a **three-option** question format; both are binding. Its 27 state-authored sample questions ship verbatim.
4. **Differentiators, all four in scope** — adaptive spaced-repetition study engine, faithful exam simulation, explain-everything answers, and a sign-recognition trainer.
5. **Design direction** — "the interface is the roadway": MUTCD sign vocabulary as the product's visual identity, dark-first. This is the one bold move; everything else stays quiet. See `stack-grounding.md` §2.
6. **Staleness posture** — the manual is current only to 2022-07-01. Verified post-2022 corrections override it and **must be disclosed in the UI**, not applied silently.

---

## Components

| # | Type | Artifacts | Pass condition |
|---|------|-----------|----------------|
| 1 | ux-mockup | `mockups/` (26 files) indexed by `state-matrix.md` | **Intent parity per matrix cell.** Every ✓ cell exists in the running app and matches its mockup in layout, hierarchy, component vocabulary, and polish. A missing cell is a gap. |
| 2 | practices | `practices-checklist.md` (A1–F6) | Every item checked, or a deviation filed and accepted. An unverifiable item counts as a gap. |
| 3 | executable | `executable-floor.md` (X1–X23) | All thresholds met. Binary. |
| 4 | content-fidelity | `practices-checklist.md` §D + `docs/research/manual-spine.md` + `docs/research/live-facts.md` | Every question cites the manual; every quote is verbatim; a sampled audit confirms the quote supports the keyed answer. |

`stack-grounding.md` is binding on all four components — it is the feasibility
ground truth, and a critic may reject work that violates it even where a
mockup appears to permit it.

---

## Judging rubric

**Intent parity, not pixel diffing.** Critics compare a screenshot of the real
running app against the corresponding mockup and judge:

1. **Completeness** — does this matrix cell exist at all, reachable in the real app?
2. **Layout & hierarchy** — same structure, same reading order, same emphasis.
3. **Component vocabulary** — built from `stack-grounding.md` §3, not improvised.
4. **Design-language fidelity** — MUTCD color semantics honored (guide green = primary/correct, red = stop/incorrect, yellow = warning/review, orange = work zone, blue = services); the Overpass/Newsreader type split respected; signs spec-accurate.
5. **Polish** — spacing rhythm, alignment, text wrapping at 320px, no orphaned or clipped content, no default-looking components.
6. **Copy** — plain verbs, sentence case, active voice; errors say what happened and what to do; empty states invite action.

**Not gaps:** font-metric differences, real data being wider or narrower than
placeholder text, one-off antialiasing differences, scrollbar presence.

**Gaps:** a missing state, an improvised component, a color used decoratively
against its MUTCD meaning, meaning conveyed by color alone, content that
breaks layout at 320px or 200% zoom, any executable threshold missed, any
question without a verbatim citation.

**Pass semantics:** all four components are **parity**, not aspirational. The
mockups were generated under the stack grounding specifically so that parity is
achievable — that is the whole reason grounding precedes imagination. There is
no scored threshold to fall back on; a piece passes when its critic can find no
gap, or it stalls and is escalated.

---

## Sources of truth

| Thing | Lives at |
|---|---|
| Official manual (PDF, 135pp, current to 2022-07-01) | `https://www.tn.gov/content/dam/tn/safety/documents/DL_Manual.pdf` |
| Extracted manual text | `docs/research/` (extract used by the content validator) |
| Structured rule/sign/number spine | `docs/research/manual-spine.md` |
| Post-2022 verified corrections | `docs/research/live-facts.md` |
| Design & feasibility ground truth | `stack-grounding.md` |
| Completeness contract | `state-matrix.md` |
| Evidence | `ledger.md` |
| Bar disputes | `deviations.md` |

---

## Stop conditions

- **PASS** — the piece's blind critic finds no gap, with evidence recorded in `ledger.md`.
- **Stall** — 2 consecutive rounds with no critic-acknowledged improvement. Escalate to the human with the evidence trail. Never silently keep burning rounds.
- **Budget** — 3 rounds per piece. On exhaustion, report honestly which pieces passed and which did not. A partial pass is a legitimate stated outcome; a quiet redefinition of "done" is not.
