"use client";

import { useThemeStore, type ThemeMode } from "./store";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/shared/utils/cn";

const options: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "라이트", Icon: Sun },
  { value: "dark", label: "다크", Icon: Moon },
  { value: "system", label: "시스템", Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div
      className={cn(
        "flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="테마 선택"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text-primary)]",
            mode === value &&
              "bg-[var(--surface-hover)] text-[var(--text-primary)]",
          )}
          title={label}
          aria-label={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
