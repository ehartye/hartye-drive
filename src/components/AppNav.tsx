import { Link, NavLink } from 'react-router';
import { SignSvg } from './SignSvg';
import { IconExam, IconProgress, IconSigns, IconStudy } from './Icon';
import type { ReactNode } from 'react';

interface Destination {
  to: string;
  label: string;
  icon: ReactNode;
}

/** The four destinations. Settings is reached from the app bar, not the nav. */
const DESTINATIONS: readonly Destination[] = [
  { to: '/study', label: 'Study', icon: <IconStudy size={22} /> },
  { to: '/exam', label: 'Exam', icon: <IconExam size={22} /> },
  { to: '/signs', label: 'Signs', icon: <IconSigns size={22} /> },
  { to: '/progress', label: 'Progress', icon: <IconProgress size={22} /> },
];

/**
 * Bottom tab bar below 1024px (safe-area inset respected), left side rail at
 * and above it (grounding §4). AppNav **owns the brand block**, rendered in
 * rail mode only — so no page positions it and the brand is never in a page
 * header (§3).
 */
export function AppNav() {
  return (
    <>
      <Link className="railbrand" to="/study">
        <SignSvg id="stop" size="sm" decorative />
        <strong>TN&nbsp;Drive</strong>
      </Link>

      <nav className="nav" aria-label="Main">
        {DESTINATIONS.map((d) => (
          <NavLink key={d.to} to={d.to}>
            {d.icon}
            {d.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
