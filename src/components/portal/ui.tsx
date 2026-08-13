/**
 * Portal UI kit — compact, operational software primitives.
 *
 * Purely presentational. These components hold no data logic; every portal page
 * keeps its own queries, mutations, filters and role gates and simply renders
 * through these building blocks so the whole portal shares one design language.
 *
 * All colors come from the `.vantage-portal` token layer in src/styles.css.
 */
import {
  createContext,
  useContext,
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="p-title">{title}</h1>
          {description && (
            <p className="p-secondary mt-1 max-w-2xl leading-snug">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("p-panel overflow-hidden", className)}>
      {(title || actions) && (
        <header
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--p-border)" }}
        >
          <div className="min-w-0">
            {title && <h2 className="p-section-title truncate">{title}</h2>}
            {description && <p className="p-secondary mt-0.5 truncate">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && "p-4", bodyClassName)}>{children}</div>
      {footer && (
        <footer className="border-t px-4 py-3" style={{ borderColor: "var(--p-border)" }}>
          {footer}
        </footer>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Metric card                                                                */
/* -------------------------------------------------------------------------- */

export function MetricCard({
  label,
  value,
  hint,
  accent,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-panel px-4 py-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="p-label uppercase tracking-[0.06em]">{label}</span>
        {icon && <span className="text-[13px]" style={{ color: "var(--p-text-3)" }}>{icon}</span>}
      </div>
      <div className="p-metric mt-1.5" style={accent ? { color: "var(--p-gold)" } : undefined}>
        {value}
      </div>
      {hint && <div className="p-muted mt-1 truncate">{hint}</div>}
    </div>
  );
}

export function MetricRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

type BtnVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type BtnSize = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(btnClass(variant, size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Small inline spinner used by Button's loading state. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent",
        className,
      )}
    />
  );
}

/** Icon-only button. `label` is required so it always has an accessible name. */
export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: BtnVariant;
  size?: BtnSize;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        btnClass(variant, size),
        "px-0",
        size === "sm"
          ? "min-w-[40px] sm:w-8 sm:min-w-0"
          : "min-w-[44px] sm:h-[36px] sm:w-[36px] sm:min-w-0",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function btnClass(variant: BtnVariant = "secondary", size: BtnSize = "md") {
  const base =
    "p-focus inline-flex items-center justify-center gap-1.5 rounded-[10px] border font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 whitespace-nowrap";
  // Phones get a 40/44px minimum tap target; desktop keeps the compact height.
  const sizes =
    size === "sm"
      ? "min-h-[40px] px-2.5 text-[13px] sm:h-8 sm:min-h-0"
      : "min-h-[44px] px-3.5 text-[13.5px] sm:h-[36px] sm:min-h-0";
  const variants: Record<BtnVariant, string> = {
    primary: "border-transparent text-[#0B0B0C] hover:brightness-[1.06]",
    secondary: "hover:brightness-[1.08]",
    outline: "bg-transparent hover:bg-[var(--p-hover)]",
    ghost: "border-transparent bg-transparent hover:bg-[var(--p-hover)]",
    destructive: "border-transparent text-white hover:brightness-[1.06]",
  };
  const styleByVariant: Record<BtnVariant, string> = {
    primary: "[background:var(--p-gold)]",
    secondary: "[background:var(--p-raised)] [border-color:var(--p-border)] [color:var(--p-text)]",
    outline: "[border-color:var(--p-border)] [color:var(--p-text)]",
    ghost: "[color:var(--p-text-2)]",
    destructive: "[background:var(--p-red)]",
  };
  return cn(base, sizes, variants[variant], styleByVariant[variant]);
}


/* -------------------------------------------------------------------------- */
/* Toolbar                                                                    */
/* -------------------------------------------------------------------------- */

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "p-panel flex flex-wrap items-center gap-2 px-3 py-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarSpacer() {
  return <div className="ml-auto" />;
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: BtnSize;
}) {
  return (
    <div
      className={cn("inline-flex rounded-[10px] border p-0.5", className)}
      style={{ background: "var(--p-raised)", borderColor: "var(--p-border)" }}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "p-focus rounded-[8px] font-medium transition",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
            )}
            style={
              active
                ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                : { color: "var(--p-text-2)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs (underline style, secondary to the page title)                        */
/* -------------------------------------------------------------------------- */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex gap-1 overflow-x-auto border-b", className)}
      style={{ borderColor: "var(--p-border)" }}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className="p-focus -mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13.5px] font-medium transition"
            style={{
              borderColor: active ? "var(--p-gold)" : "transparent",
              color: active ? "var(--p-text)" : "var(--p-text-2)",
            }}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1.5 text-[12px]" style={{ color: "var(--p-text-3)" }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

export type BadgeTone = "neutral" | "gold" | "green" | "amber" | "red" | "blue";

const TONE_VARS: Record<BadgeTone, { fg: string; bg: string }> = {
  neutral: { fg: "var(--p-text-2)", bg: "var(--p-hover)" },
  gold: { fg: "var(--p-gold)", bg: "var(--p-gold-soft)" },
  green: { fg: "var(--p-green)", bg: "rgba(63,179,127,0.12)" },
  amber: { fg: "var(--p-amber)", bg: "rgba(224,163,46,0.12)" },
  red: { fg: "var(--p-red)", bg: "rgba(220,106,98,0.12)" },
  blue: { fg: "var(--p-blue)", bg: "rgba(91,147,216,0.12)" },
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  const t = TONE_VARS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
        className,
      )}
      style={{ color: t.fg, background: t.bg }}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.fg }} aria-hidden />
      )}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("p-panel overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

/**
 * `minWidth` guarantees the table scrolls sideways inside `TableWrap` instead of
 * crushing its columns on a phone. Pass a larger value for wide tables.
 */
export function Table({
  children,
  className,
  minWidth = 620,
}: {
  children: ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <table className={cn("w-full border-collapse text-[13px]", className)} style={{ minWidth }}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr
        className="border-b text-left"
        style={{ borderColor: "var(--p-border)", background: "var(--p-hover)" }}
      >
        {children}
      </tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      style={{ color: "var(--p-text-3)" }}
    >
      {children}
    </th>
  );
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b transition last:border-b-0 hover:bg-[var(--p-hover)]",
        onClick && "cursor-pointer",
        className,
      )}
      style={{ borderColor: "var(--p-border)" }}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-3 py-2.5 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {icon && (
        <div
          className="mb-3 grid h-9 w-9 place-items-center rounded-[10px] text-[15px]"
          style={{ background: "var(--p-raised)", color: "var(--p-text-3)" }}
        >
          {icon}
        </div>
      )}
      <div className="p-card-title">{title}</div>
      {description && (
        <p className="p-secondary mt-1 max-w-sm leading-snug">{description}</p>
      )}
      {action && <div className="mt-3 flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 16px text below `sm` keeps iOS Safari from zooming the page on focus; the
 * compact 14px sizing takes over from the `sm` breakpoint up.
 */
const controlClass =
  "p-focus w-full rounded-[10px] border px-3 text-[16px] transition placeholder:opacity-60 sm:text-[14px] [background:var(--vantage-input-bg)] [border-color:var(--p-border)] [color:var(--p-text)] focus:[border-color:var(--p-gold)]";

/** Minimum 44px tap height on phones, 40px on desktop. */
const controlHeight = "h-[44px] sm:h-[40px]";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, controlHeight, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "min-h-[92px] py-2.5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, controlHeight, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="p-label mb-1.5 block">
          {label}
          {required && <span style={{ color: "var(--p-gold)" }}> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="p-muted mt-1 block leading-snug">{hint}</span>}
      {error && (
        <span className="mt-1 block text-[12px]" style={{ color: "var(--p-red)" }}>
          {error}
        </span>
      )}
    </label>
  );
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Search field                                                               */
/* -------------------------------------------------------------------------- */

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0 basis-full sm:min-w-[220px] sm:flex-1 sm:basis-auto", className)}>
      <Search
        size={14}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        style={{ color: "var(--p-text-3)" }}
        aria-hidden
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(controlClass, "h-[44px] pl-8 sm:h-9 sm:text-[13.5px]")}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({
  name,
  email,
  size = 32,
  src,
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
  src?: string | null;
  className?: string;
}) {
  const initials =
    (name || email || "?")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ""}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        background: "var(--p-gold-soft)",
        color: "var(--p-gold)",
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

const ModalCtx = createContext<{ close: () => void }>({ close: () => {} });
export const useModal = () => useContext(ModalCtx);

export function Modal({
  title,
  description,
  onClose,
  footer,
  children,
  width = 560,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
  bodyClassName?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <ModalCtx.Provider value={{ close: onClose }}>
      <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden
        />
        <div
          role="dialog"
          aria-modal="true"
          className="p-panel p-safe-b relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col"
          style={{ maxWidth: width }}
        >
          <header
            className="flex items-start justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--p-border)" }}
          >
            <div className="min-w-0">
              <h2 className="p-section-title">{title}</h2>
              {description && <p className="p-secondary mt-0.5 leading-snug">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-focus grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-[var(--p-hover)]"
              style={{ color: "var(--p-text-2)" }}
            >
              <X size={15} aria-hidden />
            </button>
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>{children}</div>
          {footer && (
            <footer
              className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3"
              style={{ borderColor: "var(--p-border)" }}
            >
              {footer}
            </footer>
          )}
        </div>
      </div>
    </ModalCtx.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc helpers                                                               */
/* -------------------------------------------------------------------------- */

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-t", className)} style={{ borderColor: "var(--p-border)" }} />;
}

export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

/** Standard page container: full width, 16px mobile / 24px desktop padding. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4 md:p-6", className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Skeletons                                                                  */
/* -------------------------------------------------------------------------- */

/** Base shimmer block. Give it a width/height via className. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-[6px]", className)}
      style={{ background: "var(--p-hover)", ...style }}
    />
  );
}

export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export function MetricSkeleton({ count = 4 }: { count?: number }) {
  return (
    <MetricRow>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-panel px-4 py-3">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-6 w-14" />
          <Skeleton className="mt-2.5 h-2.5 w-24" />
        </div>
      ))}
    </MetricRow>
  );
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("p-panel p-4", className)}>
      <Skeleton className="h-3 w-32" />
      <div className="mt-4">
        <TextSkeleton lines={lines} />
      </div>
    </div>
  );
}

/** Rows sized to a compact table, rendered inside the standard table surface. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <TableWrap>
      <div className="px-3 py-2.5" style={{ background: "var(--p-hover)" }}>
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b px-3 py-3 last:border-b-0"
            style={{ borderColor: "var(--p-border)" }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className="h-3 flex-1"
                style={{ maxWidth: c === 0 ? 180 : 120, opacity: 1 - c * 0.12 }}
              />
            ))}
          </div>
        ))}
      </div>
    </TableWrap>
  );
}

/** List/feed skeleton for panels that render stacked rows rather than a table. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Error state                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Friendly failure state. Raw backend messages are never shown — pass a plain
 * sentence and, where the caller has a query, an `onRetry`.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}
      role="alert"
    >
      <div
        className="mb-3 grid h-9 w-9 place-items-center rounded-[10px] text-[15px]"
        style={{ background: "rgba(220,106,98,0.12)", color: "var(--p-red)" }}
        aria-hidden
      >
        !
      </div>
      <div className="p-card-title">{title}</div>
      <p className="p-secondary mt-1 max-w-sm leading-snug">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Drawer (right side on desktop, bottom sheet on mobile)                     */
/* -------------------------------------------------------------------------- */

export function Drawer({
  title,
  description,
  onClose,
  footer,
  children,
  width = 520,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
  bodyClassName?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <ModalCtx.Provider value={{ close: onClose }}>
      <div className="fixed inset-0 z-[80] flex items-end sm:items-stretch sm:justify-end">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          className="p-panel relative z-10 flex max-h-[92vh] w-full flex-col rounded-b-none sm:h-full sm:max-h-none sm:max-w-[var(--drawer-w)] sm:rounded-none sm:border-y-0 sm:border-r-0"
          style={{ "--drawer-w": `${width}px` } as CSSProperties}
        >
          <header
            className="flex items-start justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--p-border)" }}
          >
            <div className="min-w-0">
              <h2 className="p-section-title truncate">{title}</h2>
              {description && <p className="p-secondary mt-0.5 leading-snug">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-focus grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-[var(--p-hover)]"
              style={{ color: "var(--p-text-2)" }}
            >
              <X size={15} aria-hidden />
            </button>
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>{children}</div>
          {footer && (
            <footer
              className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3"
              style={{ borderColor: "var(--p-border)" }}
            >
              {footer}
            </footer>
          )}
        </div>
      </div>
    </ModalCtx.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Toggle / checkbox / radio                                                  */
/* -------------------------------------------------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === "string" ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "p-focus relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-45",
      )}
      style={{
        background: checked ? "var(--p-gold)" : "var(--p-hover)",
        borderColor: checked ? "var(--p-gold)" : "var(--p-border)",
      }}
    >
      <span
        className="ml-[2px] h-[16px] w-[16px] rounded-full transition-transform"
        style={{
          background: checked ? "#0B0B0C" : "var(--p-text-2)",
          transform: checked ? "translateX(16px)" : "translateX(0)",
        }}
        aria-hidden
      />
    </button>
  );
  if (!label) return <span className={className}>{control}</span>;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{label}</div>
        {description && <div className="p-muted mt-0.5 leading-snug">{description}</div>}
      </div>
      {control}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-[13.5px]", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="p-focus h-4 w-4 shrink-0 cursor-pointer rounded-[4px] border accent-[var(--p-gold)] disabled:cursor-not-allowed"
        style={{ borderColor: "var(--p-border)" }}
      />
      {label}
    </label>
  );
}

export function Radio({
  checked,
  onChange,
  label,
  name,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  label?: ReactNode;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-[13.5px]", className)}>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="p-focus h-4 w-4 shrink-0 cursor-pointer accent-[var(--p-gold)] disabled:cursor-not-allowed"
      />
      {label}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Section nav (settings / admin sub-navigation)                              */
/* -------------------------------------------------------------------------- */

export function SectionNav<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: T; label: ReactNode; hint?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-0.5", className)} aria-label="Sections">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(it.value)}
            className="p-focus flex min-h-[38px] w-full items-center rounded-[10px] px-3 text-left text-[13.5px] font-medium transition"
            style={
              active
                ? { background: "var(--p-gold-soft)", color: "var(--p-gold)" }
                : { color: "var(--p-text-2)" }
            }
          >
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Single toast vocabulary for the portal. Errors never surface raw backend
 * text — callers pass a plain sentence; unknown errors fall back to a generic
 * message.
 */
type NotifyAction = { label: string; onClick: () => void };

export const notify = {
  success: (message: string, description?: string, action?: NotifyAction) =>
    toast.success(message, { description, action }),
  info: (message: string, description?: string, action?: NotifyAction) =>
    toast(message, { description, action }),
  warning: (message: string, description?: string, action?: NotifyAction) =>
    toast.warning(message, { description, action }),
  error: (message = "Something went wrong", description?: string, action?: NotifyAction) =>
    toast.error(message, { description, action }),
};
