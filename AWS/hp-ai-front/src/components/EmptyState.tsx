import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/50 py-12 px-6 text-center dark:border-gray-600 dark:bg-gray-800/50",
        className,
      )}
    >
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
}
