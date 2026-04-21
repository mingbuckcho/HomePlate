"use client";

import { cn } from "@/shared/utils/cn";

type BaseballIconProps = {
  size?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
};

/**
 * 야구공: 원 + 심(곡선 2개) + 스티치.
 * fill 기본 "none" → 로고 형식(선만). 채우기 원하면 fill="#FFFFFF" 등 전달.
 */
export function BaseballIcon({
  size = 64,
  fill = "none",
  stroke = "#e31b23",
  strokeWidth = 2.5,
  className,
}: BaseballIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      role="img"
    >
      <circle
        cx="32"
        cy="32"
        r="28"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 12 C14 22, 14 42, 22 52" />
        <path d="M42 12 C50 22, 50 42, 42 52" />
        <path d="M18.8 18.5 L23.2 16.2" />
        <path d="M17.2 24.8 L22.0 23.0" />
        <path d="M16.7 31.7 L21.7 31.7" />
        <path d="M17.2 38.6 L22.0 40.4" />
        <path d="M18.8 44.9 L23.2 47.2" />
        <path d="M45.2 16.2 L49.6 18.5" />
        <path d="M46.4 23.0 L51.2 24.8" />
        <path d="M46.3 31.7 L51.3 31.7" />
        <path d="M46.4 40.4 L51.2 38.6" />
        <path d="M45.2 47.2 L49.6 44.9" />
      </g>
    </svg>
  );
}
