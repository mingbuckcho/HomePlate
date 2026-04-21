import { cn } from "@/shared/utils/cn";

type Variant = "primary" | "ghost" | "secondary";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40",
        variant === "primary" &&
          "bg-[var(--accent)] text-white hover:opacity-90",
        variant === "ghost" &&
          "bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
        variant === "secondary" &&
          "border border-[var(--border-focus)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface)]",
        className,
      )}
    />
  );
}
