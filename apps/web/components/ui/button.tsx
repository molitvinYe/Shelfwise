import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:opacity-90',
  secondary: 'border border-border bg-surface hover:bg-border/40',
  ghost: 'text-muted hover:bg-border/40 hover:text-foreground',
};

export const buttonClasses = (variant: Variant = 'primary') =>
  `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shows the pending label and disables the button. */
  pending?: boolean;
  pendingLabel?: string;
}

export function Button({
  variant = 'primary',
  pending = false,
  pendingLabel,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${buttonClasses(variant)} ${className}`}
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
