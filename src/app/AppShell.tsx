import { Outlet, useLocation } from 'react-router';
import { AppNav } from '~/components';
import { isReady, useSetupStore } from '~/store/setup';

/**
 * The standing shell: nav plus the routed page. The shell owns the nav offset
 * (bottom bar below 1024px, side rail above), so no page positions the nav or
 * undoes a body padding it did not set (§3, §4).
 *
 * One exception, and it is the mockups' (01 / 01b): on first run the Study
 * destination is onboarding, and there is nothing to navigate to yet — the four
 * destinations appear once the two questions are answered. A learner who deep
 * links to another destination before then still gets the nav, so nothing is
 * ever unreachable. The shell decides this, not the page, because the offset is
 * the shell's to own.
 */
export function AppShell() {
  const ready = useSetupStore(isReady);
  const { pathname } = useLocation();
  const onboarding = !ready && (pathname === '/' || pathname === '/study');

  return (
    <div className={onboarding ? 'shell shell--focus' : 'shell'}>
      {!onboarding && <AppNav />}
      <Outlet />
    </div>
  );
}
