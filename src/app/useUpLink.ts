/**
 * "Up", for a page with more than one parent.
 *
 * Settings is reached from the progress footer, the progress export row, a
 * correction tag in an exam review, and the rule reference; the rule reference
 * is reached from a study explanation, an exam review, the sign library and
 * another rule. Neither has a single parent, so a fixed `backTo` sends most of
 * their visitors somewhere they had not been — which is what `AppBar`'s own
 * `onBack` exists for.
 *
 * But `navigate(-1)` alone is not enough either. Deep links must work offline
 * (grounding §1), and on a cold deep link there is no in-app history to go back
 * to: the control is drawn, pressed, and nothing happens. React Router stamps
 * `location.key` as `'default'` on exactly that entry — the one the session
 * started on — so the two cases are distinguishable, and each gets the
 * behaviour that actually works.
 */
import { useLocation, useNavigate } from 'react-router';

export interface UpLink {
  /** Spread onto `AppBar`: `onBack` mid-session, `backTo` on a cold entry. */
  props: { onBack: () => void } | { backTo: string };
}

export function useUpLink(fallback: string): UpLink['props'] {
  const location = useLocation();
  const navigate = useNavigate();
  return location.key === 'default'
    ? { backTo: fallback }
    : {
        onBack: () => {
          void navigate(-1);
        },
      };
}
