import type { ReactNode } from 'react';
import { AppBar, SignPanel } from '~/components';
import { usePageTitle } from '~/app/usePageTitle';

export interface PlaceholderProps {
  /** Page title in the app bar and the document title. */
  title: string;
  /** Context line — hidden below 900px, where the title and badge need the bar. */
  context: string;
  /** The single `<h1>` for this page. */
  heading: string;
  lede: string;
  /** Which piece fills this in. Stated plainly rather than left blank. */
  owner: string;
  children?: ReactNode;
}

/**
 * A routed destination that P1 stands up but does not fill. Every one of these
 * is replaced by the piece named in `owner`; none of them is a white screen in
 * the meantime.
 */
export function Placeholder({ title, context, heading, lede, owner, children }: PlaceholderProps) {
  usePageTitle(title);

  return (
    <>
      <AppBar title={title} context={context} />
      <main className="wrap stack pt-6">
        <div>
          <p className="eyebrow">Class D knowledge test</p>
          <h1>{heading}</h1>
          <p className="dim mt-2 text-[0.9375rem]">{lede}</p>
        </div>

        {children}

        <SignPanel as="section" variant="route" flat>
          <p className="eyebrow eyebrow--route">Not built yet</p>
          <p className="dim text-sm">{owner}</p>
        </SignPanel>

        <p className="faint text-[0.75rem] text-center leading-normal mt-6">
          Questions cite the Tennessee Comprehensive Driver License Manual.
          <br />
          Not affiliated with the State of Tennessee.
        </p>
      </main>
    </>
  );
}
