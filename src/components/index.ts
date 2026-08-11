/**
 * The §3 component vocabulary. Builders may use **only** these; adding a
 * component means adding it to `stack-grounding.md` §3 first, via a deviation.
 */
export { SignSvg } from './SignSvg';
export type { SignSvgProps, SignSize } from './SignSvg';

export { SignPanel } from './SignPanel';
export type { SignPanelProps, PanelVariant } from './SignPanel';

export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';

export { ChoiceRow } from './ChoiceRow';
export type { ChoiceRowProps, ChoiceState } from './ChoiceRow';

export { QuestionCard } from './QuestionCard';
export type { QuestionCardProps } from './QuestionCard';

export { ExplanationBlock } from './ExplanationBlock';
export type { ExplanationBlockProps, Citation } from './ExplanationBlock';

export { MileMarker, RouteShield, StatTile } from './markers';
export type { MileMarkerProps, RouteShieldProps, StatTileProps } from './markers';

export { ProgressRail, TopicMeter } from './meters';
export type { ProgressRailProps, TopicMeterProps, RailTone } from './meters';

export { Timer, StrikeCounter, VerdictSign } from './exam';
export type { TimerProps, StrikeCounterProps, VerdictSignProps, VerdictVariant } from './exam';

export { EmptyState, ErrorState, LoadingSkeleton } from './states';
export type { EmptyStateProps, ErrorStateProps, LoadingSkeletonProps } from './states';

export { Toast, ToastDock } from './Toast';
export type { ToastProps, ToastTone } from './Toast';

export { Dialog } from './Dialog';
export type { DialogProps } from './Dialog';

export { AppNav } from './AppNav';
export { AppBar, OfflineBadge } from './AppBar';
export type { AppBarProps, OfflineBadgeProps } from './AppBar';

export { CitationLink } from './CitationLink';
export type { CitationLinkProps } from './CitationLink';

export { VisuallyHidden } from './VisuallyHidden';
export type { VisuallyHiddenProps } from './VisuallyHidden';

export { FocusChrome } from './FocusChrome';
export type { FocusChromeProps } from './FocusChrome';

export {
  Chip,
  ConfirmGate,
  DateField,
  SearchField,
  SegmentedField,
  SwitchRow,
} from './forms';
export type {
  ChipProps,
  ConfirmGateProps,
  DateFieldProps,
  SearchFieldProps,
  SegmentedFieldProps,
  SegmentedOption,
  SwitchRowProps,
} from './forms';
