"use client";

import { useEffect } from "react";
import { useNotificationStore } from "./store";
import { cn } from "@/shared/utils/cn";

const AUTO_CLOSE_MS = 4000;

export function ToastList() {
  const toasts = useNotificationStore((s) => s.toasts);
  const remove = useNotificationStore((s) => s.remove);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] flex flex-col gap-2 md:left-auto md:right-4 md:max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: { id: string; type: string; message: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-medium shadow-lg",
        toast.type === "success" &&
          "border-green-500/30 bg-green-500/95 text-white",
        toast.type === "error" &&
          "border-[var(--accent)]/30 bg-[var(--accent)]/95 text-white",
        toast.type === "info" &&
          "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)]",
      )}
    >
      {toast.message}
    </div>
  );
}
