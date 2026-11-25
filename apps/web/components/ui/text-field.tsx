import { type InputHTMLAttributes, useId } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** Labelled input with an accessible error / hint. Works with react-hook-form's `register()`. */
export function TextField({
  label,
  error,
  hint,
  id,
  ...props
}: TextFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 aria-invalid:border-danger sm:text-sm"
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
