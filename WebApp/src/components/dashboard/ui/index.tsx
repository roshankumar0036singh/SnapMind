'use client';

/**
 * Dashboard primitives.
 *
 * Every value here traces back to a token already defined in globals.css or a
 * shape already used on the landing page, so dashboard surfaces and marketing
 * surfaces stay visually identical:
 *   - panels     rounded-3xl + hairline border + shadow-theme-sm   (pricing/card.tsx)
 *   - buttons    rounded-full h-12 primary-500/600, or .gradient-btn (hero-section)
 *   - dark       dark-primary #171F2E inset on dark-secondary #1A2231 page
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, Check, Loader2, Minus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';

/* --------------------------------- surfaces ------------------------------- */

export const PANEL =
  'rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-dark-primary shadow-theme-sm';

export const INSET = 'rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5';

export function Panel({
  children,
  className,
  padded = true,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside';
}) {
  return <Tag className={cn(PANEL, padded && 'p-5 sm:p-6', className)}>{children}</Tag>;
}

/* -------------------------------- typography ------------------------------ */

export function PageHeader({
  icon,
  title,
  description,
  accent = 'text-primary-600 bg-primary-50 dark:bg-primary-500/10',
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  accent?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5 min-w-0">
        {icon && (
          <div
            className={cn(
              'w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center',
              accent,
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white/90 truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4 mb-4', className)}>
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- buttons -------------------------------- */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:shadow-ring';

const BTN_SIZE = {
  sm: 'h-9 px-4 text-xs',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-sm',
} as const;

const BTN_VARIANT = {
  primary: 'bg-primary-500 hover:bg-primary-600 text-white',
  gradient: 'gradient-btn text-white',
  soft: 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-300 dark:hover:bg-primary-500/20',
  outline:
    'border border-gray-200 dark:border-white/15 text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/5',
  ghost:
    'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5',
  danger: 'bg-error-500 hover:bg-error-600 text-white',
} as const;

type ButtonProps = {
  children?: ReactNode;
  variant?: keyof typeof BTN_VARIANT;
  size?: keyof typeof BTN_SIZE;
  className?: string;
  loading?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  loading,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(BTN_BASE, BTN_SIZE[size], BTN_VARIANT[variant], className)}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = 'primary',
  size = 'md',
  className,
}: {
  children: ReactNode;
  href: string;
  variant?: keyof typeof BTN_VARIANT;
  size?: keyof typeof BTN_SIZE;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(BTN_BASE, BTN_SIZE[size], BTN_VARIANT[variant], className)}>
      {children}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  className,
  ...rest
}: { icon: ReactNode; label: string; className?: string } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className'
>) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 dark:text-gray-500',
        'hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10',
        'transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:shadow-ring',
        className,
      )}
    >
      {icon}
    </button>
  );
}

/* ---------------------------------- badges -------------------------------- */

export function Pill({
  children,
  tone = 'neutral',
  className,
  onClick,
  active,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'error' | 'warning';
  className?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
    brand: 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
    success: 'bg-success-50 text-success-600 dark:bg-success-600/15 dark:text-emerald-300',
    error: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-red-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  } as const;

  const cls = cn(
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
    tones[tone],
    active && 'ring-2 ring-primary-500/40',
    onClick && 'cursor-pointer hover:opacity-80 transition',
    className,
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function IconBadge({
  icon,
  className,
  size = 'md',
}: {
  icon: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'w-8 h-8 rounded-xl', md: 'w-10 h-10 rounded-2xl', lg: 'w-12 h-12 rounded-2xl' };
  return (
    <div className={cn('shrink-0 flex items-center justify-center', sizes[size], className)}>
      {icon}
    </div>
  );
}

/* --------------------------------- stat tile ------------------------------ */

export function StatTile({
  label,
  value,
  icon,
  hint,
  accent = 'text-primary-600 bg-primary-50 dark:bg-primary-500/10',
  href,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  accent?: string;
  href?: string;
  loading?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        {icon && <IconBadge size="sm" icon={icon} className={accent} />}
      </div>
      {/* Proportional figures on purpose: tabular-nums makes display-size
          numerals read loose. Tabular is reserved for aligned columns. */}
      <div className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white/90">
        {loading ? <Skeleton className="h-7 w-16" /> : value}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">{hint}</p>}
    </>
  );

  const cls = cn(PANEL, 'p-5 transition', href && 'hover:shadow-theme-lg hover:-translate-y-0.5');

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* -------------------------------- feedback -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-100 dark:bg-white/10 motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('w-4 h-4 animate-spin text-primary-500', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-14 sm:py-20',
        className,
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-3xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-5">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-error-100 dark:border-error-500/25 bg-error-50 dark:bg-error-500/10 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-error-600 dark:text-red-300 shrink-0 mt-0.5" />
      <p className="text-sm text-error-600 dark:text-red-200 flex-1 break-words">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-medium text-error-600 dark:text-red-200 underline shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* -------------------------------- segmented ------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/10',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-medium transition',
            value === o.value
              ? 'bg-white dark:bg-white/15 text-gray-900 dark:text-white shadow-theme-xs'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-6 shrink-0 rounded-full transition mt-0.5 focus-visible:outline-none focus-visible:shadow-ring',
          checked ? 'bg-primary-500' : 'bg-gray-200 dark:bg-white/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-theme-xs transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-gray-900 dark:text-white/90">{label}</span>
        {hint && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/* --------------------------------- inputs --------------------------------- */

/** Shared field chrome so every text input across the dashboard matches. */
export const FIELD =
  'w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-primary-400 focus:shadow-ring transition';

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Optional: search-as-you-type stays the default, Enter can mean "go". */
  onEnter?: () => void;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(FIELD, 'pl-10 pr-9')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        FIELD,
        'py-2.5 pr-8 cursor-pointer appearance-none bg-no-repeat',
        // Chevron drawn inline so no extra element is needed inside a <select>.
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239ca3af%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:16px] bg-[position:right_0.6rem_center]",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  indeterminate?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-[18px] h-[18px] shrink-0 rounded-[6px] border flex items-center justify-center transition',
        'focus-visible:outline-none focus-visible:shadow-ring',
        checked || indeterminate
          ? 'bg-primary-500 border-primary-500 text-white'
          : 'border-gray-300 dark:border-white/25 text-transparent hover:border-primary-400',
        className,
      )}
    >
      {indeterminate ? (
        <Minus className="w-3 h-3" strokeWidth={3} />
      ) : (
        <Check className="w-3 h-3" strokeWidth={3} />
      )}
    </button>
  );
}

/* ---------------------------------- drawer -------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-end transition-opacity duration-200',
        open ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative h-full w-full bg-white dark:bg-dark-primary border-l border-gray-100 dark:border-white/10',
          'flex flex-col shadow-theme-lg transition-transform duration-300 ease-out motion-reduce:transition-none',
          width,
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
            )}
          </div>
          <IconButton icon={<X className="w-4 h-4" />} label="Close" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">{children}</div>
        {footer && (
          <footer className="px-6 py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02]">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------ confirm dialog ---------------------------- */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  tone = 'danger',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(PANEL, 'relative w-full max-w-md p-6 shadow-theme-lg')}
      >
        <div className="flex items-start gap-3.5">
          <IconBadge
            icon={<AlertTriangle className="w-5 h-5" />}
            className={
              tone === 'danger'
                ? 'text-error-600 bg-error-50 dark:bg-error-500/10'
                : 'text-primary-600 bg-primary-50 dark:bg-primary-500/10'
            }
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{title}</h2>
            {description && (
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 break-words">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            autoFocus
            variant={tone}
            size="sm"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- misc ----------------------------------- */

export function CopyableCode({ value, className }: { value: string; className?: string }) {
  return (
    <code
      className={cn(
        'block w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-white/10',
        'font-mono text-xs text-gray-700 dark:text-gray-300 break-all',
        className,
      )}
    >
      {value}
    </code>
  );
}

export function CheckLine({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span
        className={cn(
          'w-5 h-5 shrink-0 rounded-full flex items-center justify-center border',
          done
            ? 'bg-success-600 border-success-600 text-white'
            : 'border-gray-200 dark:border-white/20 text-transparent',
        )}
      >
        <Check className="w-3 h-3" strokeWidth={3} />
      </span>
      <span
        className={cn(
          done
            ? 'text-gray-400 dark:text-gray-500 line-through'
            : 'text-gray-700 dark:text-gray-300',
        )}
      >
        {children}
      </span>
    </li>
  );
}
