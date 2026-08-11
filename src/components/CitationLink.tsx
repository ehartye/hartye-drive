import { Link } from 'react-router';
import { IconExternal } from './Icon';

export interface CitationLinkProps {
  /** In-app rule reference. Citations resolve inside the app — it works offline. */
  to: string;
  section: string;
  pdfPage: number;
}

/**
 * The affordance that turns a citation into something a learner can follow.
 * Interstate blue, because informational is what blue means here (§2).
 */
export function CitationLink({ to, section, pdfPage }: CitationLinkProps) {
  return (
    <Link className="citelink" to={to}>
      <IconExternal size={12} />
      {`${section} · PDF p. ${pdfPage}`}
    </Link>
  );
}
