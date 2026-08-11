/**
 * Portal UI kit — compact, operational software primitives.
 *
 * Purely presentational. These components hold no data logic; every portal page
 * keeps its own queries, mutations, filters and role gates and simply renders
 * through these building blocks so the whole portal shares one design language.
 *
 * All colors come from the `.apx-portal` token layer in src/styles.css.
 */
import {
  createContext,
  useContext,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="p-title truncate">{title}</h1>
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

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";
type BtnSize = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button className={cn(btnClass(variant, size), className)} {...rest} />
  );
}

export function btnClass(variant: BtnVariant = "secondary", size: BtnSize = "md") {
  const base =
    "p-focus inline-flex items-center justify-center gap-1.5 rounded-[10px] border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
  const sizes = size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-[36px] px-3.5 text-[13.5px]";
  const variants: Record<BtnVariant, string> = {
    primary: "border-transparent text-[#0B0B0C] hover:brightness-[1.06]",
    secondary: "hover:brightness-[1.08]",
    ghost: "border-transparent bg-transparent hover:bg-[var(--p-hover)]",
    destructive: "border-transparent text-white hover:brightness-[1.06]",
  };
  const styleByVariant: Record<BtnVariant, string> = {
    primary: "[background:var(--p-gold)]",
    secondary: "[background:var(--p-raised)] [border-color:var(--p-border)] [color:var(--p-text)]",
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

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cn("w-full border-collapse text-[13px]", className)}>{children}</table>
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

const controlClass =
  "p-focus w-full rounded-[10px] border px-3 text-[14px] transition placeholder:opacity-60 [background:var(--apx-input-bg)] [border-color:var(--p-border)] [color:var(--p-text)] focus:[border-color:var(--p-gold)]";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, "h-[40px]", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "min-h-[92px] py-2.5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, "h-[40px] pr-8", className)} {...rest}>
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
    <div className={cn("relative min-w-0 flex-1", className)}>
      <span
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[13px]"
        style={{ color: "var(--p-text-3)" }}
        aria-hidden
      >
        ⌕
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(controlClass, "h-9 pl-7 text-[13.5px]")}
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
          className="p-panel relative z-10 my-auto flex w-full max-h-[calc(100vh-2rem)] flex-col"
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
              className="p-focus grid h-7 w-7 shrink-0 place-items-center rounded-md text-[14px] hover:bg-[var(--p-hover)]"
              style={{ color: "var(--p-text-2)" }}
            >
              ✕
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
