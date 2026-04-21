import { cn } from "@/shared/utils/cn";

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition",
        active
          ? "bg-[var(--accent)] text-white"
          : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
