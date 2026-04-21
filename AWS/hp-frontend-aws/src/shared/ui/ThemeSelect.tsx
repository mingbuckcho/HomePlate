"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export type ThemeSelectOption = { value: string; label: string };

export function ThemeSelect({
  value,
  onChange,
  options,
  placeholder = "선택",
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ThemeSelectOption[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          "input-base flex h-9 w-full items-center justify-between rounded-lg px-3 text-left text-sm",
          !value && "text-[var(--text-muted)]",
        )}
      >
        <span>{display}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-muted)] transition",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-solid)] py-1 shadow-lg"
        >
          {!options.some((o) => o.value === "") && (
            <li role="option">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm",
                  !value
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                {placeholder}
              </button>
            </li>
          )}
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={value === o.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                  value === o.value &&
                    "bg-[var(--accent-muted)] text-[var(--accent)]",
                )}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
