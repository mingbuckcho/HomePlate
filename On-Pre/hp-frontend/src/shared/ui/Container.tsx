import { cn } from "@/shared/utils/cn";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-6", className)}>
      {children}
    </div>
  );
}
