import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message?: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "오류가 발생했습니다. 재시도해 주세요.",
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 py-12 px-6 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-red-700">{message}</p>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
        >
          재시도
        </button>
      )}
    </div>
  );
}
