"use client";

import { useMemo } from "react";
import type { SeatSection } from "../maps/types";

type ViewBox = { x: number; y: number; w: number; h: number };

type SeatMapProps = {
  sections: SeatSection[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  getFill?: (section: SeatSection, isSelected: boolean, isHover: boolean) => string;
  getStroke?: (section: SeatSection, isSelected: boolean, isHover: boolean) => string;
  viewBox?: ViewBox;
  className?: string;
  /** Optional background image displayed behind the SVG (e.g., stadium map). */
  backgroundSrc?: string;
  /** Background opacity (0~1). Default: 0.35 */
  backgroundOpacity?: number;
};

function calcAutoViewBox(sections: SeatSection[]): ViewBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const s of sections) {
    for (const [x, y] of s.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, w: 100, h: 100 };
  }

  const pad = 2;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

export default function SeatMap({
  sections,
  selectedId,
  onSelect,
  getFill,
  getStroke,
  viewBox,
  className,
  backgroundSrc,
  backgroundOpacity,
}: SeatMapProps) {
  const safeSections = Array.isArray(sections) ? sections : [];

  const vb = useMemo(() => viewBox ?? calcAutoViewBox(safeSections), [viewBox, safeSections]);

  const fillFn =
    getFill ??
    ((_: SeatSection, isSelected: boolean, isHover: boolean) => {
      if (isSelected) return "rgba(255,255,255,0.9)";
      if (isHover) return "rgba(255,255,255,0.35)";
      return "rgba(255,255,255,0.18)";
    });

  const strokeFn =
    getStroke ??
    ((_: SeatSection, isSelected: boolean, isHover: boolean) => {
      if (isSelected) return "rgba(255,255,255,0.95)";
      if (isHover) return "rgba(255,255,255,0.5)";
      return "rgba(255,255,255,0.35)";
    });

  return (
    <div className={className ?? "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40"}>
      <svg className="block h-full w-full select-none" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
        {backgroundSrc ? (
          <image
            href={backgroundSrc}
            x={vb.x}
            y={vb.y}
            width={vb.w}
            height={vb.h}
            opacity={backgroundOpacity ?? 0.35}
            preserveAspectRatio="none"
          />
        ) : null}

        {safeSections.map((s) => {
          const isSelected = selectedId === s.id;
          const isHover = false;

          const d = `M ${s.points.map(([x, y]) => `${x},${y}`).join(" L ")} Z`;

          return (
            <path
              key={s.id}
              d={d}
              fill={fillFn(s, isSelected, isHover)}
              stroke={strokeFn(s, isSelected, isHover)}
              strokeWidth={0.25}
              className="cursor-pointer transition-opacity"
              opacity={isSelected ? 0.95 : isHover ? 0.9 : 0.75}
              onClick={() => onSelect?.(s.id)}
            />
          );
        })}
      </svg>
    </div>
  );
}
