import { useId, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { IconCheck, IconCalendar, IconSearch, IconX } from './Icon';

/* --------------------------------------------------------------- DateField */

interface Segments {
  month: string;
  day: string;
  year: string;
}

const splitIso = (iso: string): Segments => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { year: m[1] ?? '', month: m[2] ?? '', day: m[3] ?? '' } : { year: '', month: '', day: '' };
};

const digitsOnly = (raw: string, max: number) => raw.replace(/\D/g, '').slice(0, max);

function joinIso({ month, day, year }: Segments): string {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (year.length !== 4 || !month || !day) return '';
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function humanDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export interface DateFieldProps {
  legend: string;
  /** ISO `YYYY-MM-DD`, or `''` while incomplete. */
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
}

/**
 * Segmented month / day / year — deliberately **not** `<input type="date">`,
 * which renders a calendar glyph on both edges plus a locale mask in Chrome and
 * something else entirely in Safari, and cannot be made cohesive (§3). Each
 * segment carries its own visible label, so every field is programmatically
 * labelled, and the resolved date is echoed in a live region.
 */
export function DateField({ legend, value, onChange, hint }: DateFieldProps) {
  const [seg, setSeg] = useState<Segments>(() => splitIso(value));
  const [seenValue, setSeenValue] = useState(value);
  const baseId = useId();

  // Adjusting state during render rather than in an effect (React docs,
  // practices E3): re-sync only when the caller hands us a different date.
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== joinIso(seg)) setSeg(splitIso(value));
  }

  const update = (patch: Partial<Segments>) => {
    const next = { ...seg, ...patch };
    setSeg(next);
    onChange(joinIso(next));
  };

  const resolved = joinIso(seg);

  return (
    <fieldset className="field border-0 p-0 m-0 min-w-0">
      <legend className="field__label">{legend}</legend>

      <div className="datefield">
        <IconCalendar size={16} className="datefield__mark" />

        <span className="datefield__seg">
          <label htmlFor={`${baseId}-m`}>Month</label>
          <input
            id={`${baseId}-m`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM"
            maxLength={2}
            value={seg.month}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              update({ month: digitsOnly(e.target.value, 2) });
            }}
          />
        </span>
        <span className="datefield__sep" aria-hidden="true">
          /
        </span>
        <span className="datefield__seg">
          <label htmlFor={`${baseId}-d`}>Day</label>
          <input
            id={`${baseId}-d`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD"
            maxLength={2}
            value={seg.day}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              update({ day: digitsOnly(e.target.value, 2) });
            }}
          />
        </span>
        <span className="datefield__sep" aria-hidden="true">
          /
        </span>
        <span className="datefield__seg datefield__seg--year">
          <label htmlFor={`${baseId}-y`}>Year</label>
          <input
            id={`${baseId}-y`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="YYYY"
            maxLength={4}
            value={seg.year}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              update({ year: digitsOnly(e.target.value, 4) });
            }}
          />
        </span>
      </div>

      <span className="datefield__echo" role="status" aria-live="polite">
        {resolved ? humanDate(resolved) : ''}
      </span>
      {hint && <span className="field__hint">{hint}</span>}
    </fieldset>
  );
}

/* -------------------------------------------------------------- ConfirmGate */

export interface ConfirmGateProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/**
 * The acknowledgement step on a destructive action. A **real**
 * `<input type="checkbox">` — real semantics, real keyboard operation, real
 * label association — visually replaced via `appearance: none`. Deliberately
 * not a `role="checkbox"` div: the gate on erasing weeks of a learner's work is
 * the last place to hand-roll a control's semantics. The checked state carries
 * a tick, so it is never colour alone (§5).
 */
export function ConfirmGate({ checked, onChange, children }: ConfirmGateProps) {
  return (
    <label className="gate">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange(e.target.checked);
        }}
      />
      <span className="gate__text">{children}</span>
    </label>
  );
}

/* --------------------------------------------------------------------- Chip */

export interface ChipProps {
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
  children: ReactNode;
  /** A category swatch. Decorative — the label already says which category. */
  dotColor?: string;
}

/** Filter pill. The pressed state carries a tick, not just a fill (§3). */
export function Chip({ pressed, onToggle, children, dotColor }: ChipProps) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={pressed}
      onClick={() => {
        onToggle(!pressed);
      }}
    >
      {dotColor && (
        <span className="chip__dot" style={{ background: dotColor }} aria-hidden="true" />
      )}
      {children}
      {pressed && <IconCheck size={12} className="chip__tick" />}
    </button>
  );
}

/* -------------------------------------------------------------- SearchField */

export interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Draw the label above the field instead of hiding it. */
  showLabel?: boolean;
}

export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  showLabel = false,
}: SearchFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={showLabel ? 'field__label' : 'sr-only'}>
        {label}
      </label>
      <div className="search">
        <IconSearch size={16} />
        <input
          id={id}
          type="search"
          autoComplete="off"
          value={value}
          placeholder={placeholder ?? ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value);
          }}
        />
        {value !== '' && (
          <button
            type="button"
            className="search__clear"
            onClick={() => {
              onChange('');
            }}
          >
            <IconX size={13} />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- SwitchRow */

export interface SwitchRowProps {
  name: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** The state is written in words beside the track, never carried by it alone. */
export function SwitchRow({ name, description, checked, onChange }: SwitchRowProps) {
  const labelId = useId();
  return (
    <div className="switchrow">
      <span className="switchrow__copy">
        <span className="switchrow__name" id={labelId}>
          {name}
        </span>
        {description && <span className="switchrow__desc">{description}</span>}
      </span>
      <span className="switchrow__control">
        <span className="switchrow__state">{checked ? 'On' : 'Off'}</span>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          onClick={() => {
            onChange(!checked);
          }}
        />
      </span>
    </div>
  );
}

/* ----------------------------------------------------------- SegmentedField */

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedFieldProps {
  legend: string;
  /** Radio group name — must be unique on the page. */
  name: string;
  value: string;
  options: readonly SegmentedOption[];
  onChange: (value: string) => void;
}

/** A real radio group styled as a segment. No custom keyboard handling needed. */
export function SegmentedField({ legend, name, value, options, onChange }: SegmentedFieldProps) {
  const labelId = useId();
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="field">
      <span className="field__label" id={labelId}>
        {legend}
      </span>
      <div className="segmented">
        {options.map((option) => (
          <label className="segmented__opt" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
