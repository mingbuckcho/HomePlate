import { cn } from "@/shared/utils/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm transition-colors hover:bg-[var(--surface-hover)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
