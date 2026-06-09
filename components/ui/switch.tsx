"use client";

import { useState } from "react";

/**
 * Minimal toggle switch. Controlled when `checked` is supplied; uncontrolled
 * fallback for the rare standalone case. Fires `onCheckedChange` with the
 * next boolean — the caller drives the persistence step.
 *
 * Built on a plain `<button>` so it's keyboard-accessible (Space / Enter) and
 * announces correctly via role=switch + aria-checked.
 */
export function Switch({
  checked: controlled,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  "data-testid": testId,
  "aria-label": ariaLabel,
  className = "",
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (next: boolean) => void;
  disabled?: boolean;
  "data-testid"?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = controlled ?? internal;

  function toggle() {
    if (disabled) return;
    const next = !isOn;
    if (controlled === undefined) setInternal(next);
    onCheckedChange?.(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      data-testid={testId}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors ${
        isOn ? "bg-primary" : "bg-secondary"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      <span
        className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
          isOn ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
