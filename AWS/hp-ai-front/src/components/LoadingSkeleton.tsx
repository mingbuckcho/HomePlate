import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({
  className,
  lines = 3,
}: LoadingSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-gray-200"
          style={{ width: i === lines - 1 && lines > 1 ? "70%" : "100%" }}
        />
      ))}
    </div>
  );
}
