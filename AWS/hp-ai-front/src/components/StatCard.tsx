import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  description,
  className,
  icon,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </span>
        {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </span>
      </div>
      {description && (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {description}
        </span>
      )}
    </div>
  );
}
