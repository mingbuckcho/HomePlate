export type DayType = "weekday" | "weekend";

export type SeatTier =
  | "premium"
  | "exciting"
  | "blue"
  | "orange"
  | "red"
  | "navy"
  | "green"
  | "purple";

export const TIER_META: Record<
  SeatTier,
  {
    label: string;
    color: string;
    price: Record<DayType, number>;
  }
> = {
  premium: {
    label: "프리미엄",
    color: "#eab308",
    price: { weekday: 90000, weekend: 90000 },
  },
  exciting: {
    label: "익사이팅존",
    color: "#000000",
    price: { weekday: 28000, weekend: 33000 },
  },
  blue: {
    label: "블루",
    color: "#2563eb",
    price: { weekday: 22000, weekend: 24000 },
  },
  orange: {
    label: "오렌지",
    color: "#f97316",
    price: { weekday: 20000, weekend: 22000 },
  },
  red: {
    label: "레드",
    color: "#dc2626",
    price: { weekday: 17000, weekend: 19000 },
  },
  navy: {
    label: "네이비",
    color: "#1e3a5f",
    price: { weekday: 14000, weekend: 16000 },
  },
  green: {
    label: "그린(외야)",
    color: "#16a34a",
    price: { weekday: 9000, weekend: 10000 },
  },
  purple: {
    label: "퍼플",
    color: "#7c3aed",
    price: { weekday: 45000, weekend: 45000 },
  },
};

export function tierLabel(tier: SeatTier): string {
  return TIER_META[tier].label;
}

export function tierColor(tier: SeatTier): string {
  return TIER_META[tier].color;
}

export function getTierPrice(tier: SeatTier, day: DayType): number {
  return TIER_META[tier].price[day];
}

export type Point = readonly [number, number];

export type SeatSection = {
  id: string;
  tier: SeatTier;
  points: Point[];
};

// Back-compat alias
export type Section = SeatSection;

// Raw JSON shape
export type SeatSectionRaw = {
  id: string;
  tier: string;
  points: number[][];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toPoint(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = value[0];
  const y = value[1];
  if (!isNumber(x) || !isNumber(y)) return null;
  return [x, y] as const;
}

export function isSeatTier(value: unknown): value is SeatTier {
  return (
    value === "premium" ||
    value === "exciting" ||
    value === "blue" ||
    value === "orange" ||
    value === "red" ||
    value === "navy" ||
    value === "green" ||
    value === "purple"
  );
}

export function normalizeSections(input: unknown): SeatSection[] {
  const list: unknown[] = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.sections)
      ? input.sections
      : [];

  const out: SeatSection[] = [];

  for (const item of list) {
    if (!isRecord(item)) continue;

    const id = item.id;
    const tier = item.tier;
    const points = item.points;

    if (typeof id !== "string") continue;

    const t: SeatTier = isSeatTier(tier) ? tier : "navy";

    const pts: Point[] = [];
    if (Array.isArray(points)) {
      for (const p of points) {
        const pt = toPoint(p);
        if (pt) pts.push(pt);
      }
    }

    if (pts.length < 3) continue;
    out.push({ id, tier: t, points: pts });
  }

  return out;
}

export function formatWon(amount: number): string {
  try {
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  } catch {
    return `${amount}원`;
  }
}
