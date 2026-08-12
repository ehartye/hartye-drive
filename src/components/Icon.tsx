/**
 * The only non-sign artwork in the product: small stroke glyphs for interface
 * affordances. Every one is decorative — the word beside it carries the
 * meaning, because colour and shape are never the sole carrier (§5).
 */
import type { SVGProps } from 'react';

type GlyphProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'>;

function Glyph({ size = 18, strokeWidth = 2, children, ...rest }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: GlyphProps) => (
  <Glyph strokeWidth={3.5} {...p}>
    <path d="M4 13l6 6L20 5" />
  </Glyph>
);

export const IconX = (p: GlyphProps) => (
  <Glyph strokeWidth={3.5} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Glyph>
);

export const IconArrowRight = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Glyph>
);

export const IconArrowLeft = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="M19 12H6M11 18l-6-6 6-6" />
  </Glyph>
);

export const IconSearch = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.6-3.6" />
  </Glyph>
);

export const IconCalendar = (p: GlyphProps) => (
  <Glyph {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Glyph>
);

export const IconCloud = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 5.8 11.2 3.4 3.4 0 0 0 7 18z" />
  </Glyph>
);

export const IconCloudOff = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 5.8 11.2 3.4 3.4 0 0 0 7 18z" />
    <path d="M3 3l18 18" />
  </Glyph>
);

export const IconStudy = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M4 10 12 3l8 7v10a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  </Glyph>
);

export const IconExam = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v6h6M9 14l2 2 4-4" />
  </Glyph>
);

export const IconSigns = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M12 2 22 12 12 22 2 12z" />
    <path d="M12 8v4M12 16h.01" />
  </Glyph>
);

export const IconProgress = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Glyph>
);

export const IconSettings = (p: GlyphProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Glyph>
);

export const IconAlert = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M12 3 22 20H2z" />
    <path d="M12 9v5M12 17h.01" />
  </Glyph>
);

export const IconChevronRight = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="M9 6l6 6-6 6" />
  </Glyph>
);

/** The manual itself — used by the "look it up" disclosure. */
export const IconBook = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="M4 5h16v15H4z" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </Glyph>
);

/** A rule that moved after the manual was written. */
export const IconChanged = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
  </Glyph>
);

/** Try again — the storage re-check and the "reopen the app" fix. */
export const IconRefresh = (p: GlyphProps) => (
  <Glyph strokeWidth={2.2} {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </Glyph>
);

/** Save a file to this device. Nothing here uploads anything. */
export const IconDownload = (p: GlyphProps) => (
  <Glyph strokeWidth={2.2} {...p}>
    <path d="M12 3v12M8 11l4 4 4-4" />
    <path d="M4 21h16" />
  </Glyph>
);

/** iOS Safari's share glyph, for the add-to-home-screen instructions. */
export const IconShare = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="M12 3v13M8 7l4-4 4 4M5 14v6h14v-6" />
  </Glyph>
);

/** Time — the pace line on onboarding. */
export const IconClock = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M12 7v5l3 2" />
    <circle cx="12" cy="12" r="9" />
  </Glyph>
);

export const IconExternal = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M14 4h6v6M20 4l-8 8" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Glyph>
);
