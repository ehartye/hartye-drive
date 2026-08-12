import { useEffect, useRef } from 'react';

/**
 * Start each new question, sign or exam item at the top of the screen, with
 * focus on it.
 *
 * The bug this exists for: you answer, the explanation opens *below* the
 * choices, you scroll down to read it, and you press Next — and the next item
 * renders while the page stays where it was. You arrive in the middle of a
 * question you have not read.
 *
 * Each surface already moved focus to its stage, and focusing an element does
 * scroll it into view — but only **minimally**, and only if it is actually out
 * of view. Whether you land at the top therefore depended on how tall that
 * particular stage happened to be. The study session and the exam got away with
 * it; the sign drill, whose stage is a hero-sized sign, stopped 314px short at a
 * 390×700 viewport. Incidental correctness in two places and a visible bug in
 * the third is one defect, not two.
 *
 * So: position the page explicitly, then focus with `preventScroll` so the
 * browser cannot second-guess the position we just set.
 *
 * The jump is instant, never smooth. A smooth scroll here is motion carrying no
 * information, which `prefers-reduced-motion` would have to suppress anyway
 * (practices A13) — and a learner pressing Next wants the next question, not an
 * animation of travelling to it.
 *
 * @param step Advances by one per item. Zero on first render, where the page is
 *             already at the top and stealing focus would be wrong.
 */
export function useAdvanceFocus<T extends HTMLElement>(step: number) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (step <= 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    ref.current?.focus({ preventScroll: true });
  }, [step]);

  return ref;
}
