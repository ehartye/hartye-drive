# TN Drive

An offline-first study app for the **Tennessee Class D knowledge test**, with the
official manual quoted behind every answer.

> **Not affiliated with the State of Tennessee.** This is an independent study
> aid. It is not a state resource and a practice result carries no official
> weight.

---

## What it is

- **506 questions**, every one carrying a **verbatim quote** from the official
  *Tennessee Comprehensive Driver License Manual* and the page it came from —
  both the PDF page and the printed page, because the manual's own answer key
  uses printed numbers and the two differ by 14.
- **A faithful exam simulator**: 30 questions, 24 to pass, 60 minutes, and the
  Tennessee-specific rule that **seven wrong ends it early** — 30 − 7 = 23,
  under the 24 you need.
- **87 road signs**, every one hand-authored SVG at true MUTCD colour and
  geometry. No clipart and no photography anywhere in the product.
- **An adaptive study engine** — a six-box Leitner ladder that returns what you
  keep getting wrong, and states its schedule to you in words it actually keeps.
- **Works with no signal.** Installable, and after the first load it opens at
  zero bytes of network.
- **No account, no server, no analytics.** Nothing leaves the device.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run verify       # the whole gate: types, lint, tests, e2e, mobile,
                     # a11y, content, signs, size
```

## How the content is trusted

The thing that makes a study app worth using is whether you can believe it. The
guarantees here are machine-checked, not asserted:

| Gate | What it enforces |
|---|---|
| `validate:content` | Every question cites the manual; every quote is **verbatim on the exact cited page**; the quote **supports the keyed answer**; the exam blueprint the manual publishes (25% signs / 25% safe driving / 25% rules / 25% drugs & alcohol) is honoured; banned content — the manual's own internal contradictions — can never enter the bank |
| `audit:signs` | Every sign carries an MUTCD designation; the face is **painted the colour it declares**, sampled in a real browser; the drawn outline **matches the declared shape**; every legend fits inside its own face, measured at both display sizes |
| `audit:explanations` | Every number a learner reads appears in the manual |
| `audit:rule-pages` | All 533 rule citations land on the exact right page |

Quotes are never retyped by hand. A script parses the research spine, verifies
each quote against the extracted manual text, and emits the data the questions
reference by id — so a fabricated quote is structurally impossible rather than
merely checked for.

Where Tennessee law has changed since the manual's July 2022 currency date, the
correction is applied **and disclosed** in Settings with its effective date and
public chapter — never applied silently.

## Built with

React 19 · TypeScript (strict) · Vite 7 · Tailwind v4 · React Router v7 ·
Zustand · Workbox · Vitest · Playwright · axe-core

Fonts are self-hosted. There are **zero third-party requests at runtime** —
asserted by a test, in both dev and production.

## How it was built

The spec was written and attacked *before* the code, and the whole record is in
the repo:

- `docs/superpowers/bars/2026-08-11-tn-drivers-test-app/` — the ratified bar:
  design grounding, a screens × states matrix, a 62-item practices checklist,
  24 executable thresholds, and 28 mockups.
- `ledger.md` — the evidence: what each piece was judged against, what the blind
  critics found, and **the two thresholds that are still missed**.
- `deviations.md` — every dispute and how it was ruled, including the ones where
  a reviewer was confidently wrong.
- `docs/research/` — the manual extract, 533 cited rules, and a live-facts pass
  on what has changed since 2022.

## Known limits

- **Lighthouse Performance 88–89** against a self-imposed bar of 90, and a cold
  first-question interactive of ~2.5–2.75s on Slow 4G against a 2.5s bar (warm
  start is ~400ms). Both were driven down hard, then reported rather than
  lowered.
- **Not yet opened on a physical iPhone.** The mobile suite runs real WebKit,
  but that is WebKitGTK, not Mobile Safari — the engine is covered, iOS's
  platform layer is not.
- **The content has not been reviewed by a human who knows Tennessee traffic
  law.** Every gate above proves a quote is verbatim, correctly placed, and
  supports its answer. None can prove a question is *pedagogically* sound.

## Licence

The Tennessee Comprehensive Driver License Manual states it is not copyrighted
and may be reproduced. Application code in this repository is MIT.
