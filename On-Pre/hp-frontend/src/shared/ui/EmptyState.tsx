"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  icon?: ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
  icon,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--accent)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
      {actionLabel && (actionHref || onAction) ? (
        <div className="mt-6">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex h-11 items-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:opacity-90 [data-theme=light]:text-white"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex h-11 items-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              {actionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
