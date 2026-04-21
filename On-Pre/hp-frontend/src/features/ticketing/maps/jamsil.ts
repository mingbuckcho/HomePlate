import type { SeatSection } from "./types";
import { normalizeSections } from "./types";
import sectionsRaw from "./jamsil.sections.json";

// ✅ 단일 소스: jamsil.sections.json
export const JAMSIL_SECTIONS: SeatSection[] = normalizeSections(sectionsRaw);

export const JAMSIL_MAP = {
  id: "jamsil",
  name: "잠실",
  sections: JAMSIL_SECTIONS,
} as const;
