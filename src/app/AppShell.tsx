import { Outlet } from 'react-router';
import { AppNav } from '~/components';

/**
 * The standing shell: nav plus the routed page. The shell owns the nav offset
 * (bottom bar below 1024px, side rail above), so no page positions the nav or
 * undoes a body padding it did not set (§3, §4).
 */
export function AppShell() {
  return (
    <div className="shell">
      <AppNav />
      <Outlet />
    </div>
  );
}
