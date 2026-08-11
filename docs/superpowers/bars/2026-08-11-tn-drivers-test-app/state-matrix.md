# State Matrix — screens × states

This is the **completeness measure**. In Phase 2, a critic drives the real app
into every ✓ cell, screenshots it, and compares against the corresponding
mockup. **A missing cell is a gap.** A `—` is a ratified exclusion, not an
omission — each one carries a reason.

Legend: **✓** mockup required · **≈** "same as populated, per note" · **—**
ratified exclusion.

| # | Screen | populated | empty | loading | error | long-content | responsive | offline |
|---|---|---|---|---|---|---|---|---|
| 1 | Onboarding (first run) | ✓ | — ¹ | — ¹ | ✓ ² | ≈ | ✓ | ≈ ³ |
| 2 | Dashboard | ✓ | ✓ ⁴ | ✓ ⁵ | ✓ ⁶ | ≈ | ✓ | ✓ ⁷ |
| 3 | Study — question asked | ✓ | — ⁸ | ✓ ⁵ | ✓ ⁶ | ✓ ⁹ | ✓ | ≈ ³ |
| 4 | Study — answer revealed | ✓ ¹⁰ | — | — | — | ✓ ⁹ | ✓ | ≈ ³ |
| 5 | Exam — in progress | ✓ | — ⁸ | ✓ ⁵ | ✓ ⁶ | ✓ ⁹ | ✓ | ≈ ³ |
| 6 | Exam — score report | ✓ ¹¹ | — | — | — | ✓ ¹² | ✓ | ≈ ³ |
| 7 | Sign trainer — drill | ✓ | — ⁸ | ✓ ⁵ | ✓ ⁶ | ≈ | ✓ | ≈ ³ |
| 8 | Sign library — browse | ✓ | ✓ ¹³ | ✓ ⁵ | ✓ ⁶ | ✓ ¹⁴ | ✓ | ≈ ³ |
| 9 | Progress | ✓ | ✓ ¹⁵ | ✓ ⁵ | ✓ ⁶ | ✓ ¹⁶ | ✓ | ≈ ³ |
| 10 | Rule reference (topic detail) | ✓ | — ⁸ | ✓ ⁵ | ✓ ⁶ | ✓ ⁹ | ✓ | ≈ ³ |
| 11 | Settings & About | ✓ | — | — | ✓ ¹⁷ | ≈ | ✓ | ✓ ⁷ |

## Cell notes

1. Onboarding **is** the empty state of the app; it has no data to load.
2. **Onboarding error** — storage unavailable (private browsing / quota / blocked). The app must explain that progress can't be saved and offer to continue in session-only mode. This is the one genuinely likely first-run failure.
3. **Offline ≈** — these screens are fully functional offline by design; the only visible difference is the persistent `OfflineBadge` in the app chrome. No separate mockup; the badge is mocked once (cell 2-offline) and reused.
4. **Dashboard empty** — onboarding complete, zero questions answered. Must be an invitation to act, not a blank slate with a sad icon.
5. **Loading ≈ skeleton** — the question bank is a local JSON import; loading is sub-100ms in practice. One shared `LoadingSkeleton` treatment mocked once (cell 2-loading) and reused. Must not flash for fast loads.
6. **Error** — corrupt or future-version persisted state, or a malformed content bundle. Must offer a recoverable path (reset this section / export a diagnostic), never a white screen.
7. **Offline (dashboard, settings)** — these surface real offline affordances: the badge, "content pack up to date", last-synced-never messaging, and the install prompt.
8. No empty state possible — content ships with the bundle; if it's missing that is the error state, not an empty state.
9. **Long-content** — the longest real question stem + **three** long choices (grounding §7: three options is the real format; this note originally said four and was wrong) + a long verbatim manual quote, at 320px width and at 200% zoom. This is where a beautiful layout usually breaks.
10. **Answer revealed** must be mocked in **both** correct and incorrect variants — the incorrect variant is the emotionally load-bearing screen of the whole product and must not read as punishment.
11. **Score report** must be mocked in **both** pass (≥24/30) and fail variants, plus the **early-termination** variant (7 wrong ends the exam before question 30) — that third one is TN-specific and is exactly the cell an inattentive build will omit.
12. Score report with all 30 questions expanded for review.
13. **Sign library empty** — a filter/search that matches nothing. Needs a real recovery action, not "no results".
14. Sign library at full inventory — every sign in the registry, scrolling, with category grouping intact.
15. **Progress empty** — no attempts yet. Charts must not render as broken axes with no data.
16. Progress with a long attempt history (50+ attempts) — chart density, list virtualization or pagination.
17. **Settings error** — two distinct screens: `11b` the destructive "reset all progress" confirmation, and `11c` its **failure path** (the erase is blocked because storage is locked or read-only). The failure path is the cell a build will omit, because "delete" is assumed to always succeed.

## Additional required mockups (variants called out above)

- 4a Study — answer revealed, **correct**
- 4b Study — answer revealed, **incorrect**
- 6a Exam score report — **passed**
- 6b Exam score report — **failed**
- 6c Exam — **ended early** (7 wrong)
- 11b Settings — reset **confirmation**
- 11c Settings — reset **failed** (storage locked)

## Cross-cutting requirements (checked on every cell, not mocked separately)

- 320px minimum viewport width, no horizontal scroll.
- 200% browser zoom without loss of content or function.
- `prefers-reduced-motion: reduce` honored.
- Visible keyboard focus on every interactive element.
- Bottom nav respects mobile safe-area insets.
