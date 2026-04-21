import { promises as fs } from "node:fs";
import path from "node:path";

type Point = [number, number];
type Section = { id: string; tier: string; points: Point[] };

function isValidSection(value: unknown): value is Section {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (typeof v.tier !== "string") return false;
  if (!Array.isArray(v.points)) return false;
  for (const p of v.points) {
    if (!Array.isArray(p) || p.length < 2) return false;
    if (typeof p[0] !== "number" || typeof p[1] !== "number") return false;
  }
  return true;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { stadiumId?: unknown; sections?: unknown };
    if (body.stadiumId !== "JAMSIL") {
      return Response.json({ ok: false, error: "unsupported stadiumId" }, { status: 400 });
    }

    const list = Array.isArray(body.sections) ? body.sections : [];
    const sections: Section[] = [];

    for (const item of list) {
      if (isValidSection(item)) sections.push(item);
    }

    const root = process.cwd();
    const mapsDir = path.join(root, "src", "features", "ticketing", "maps");

    const sectionsPath = path.join(mapsDir, "jamsil.sections.json");
    const editorPath = path.join(mapsDir, "jamsil.editor.json");

    const payload = JSON.stringify(sections, null, 2);
    await fs.mkdir(mapsDir, { recursive: true });
    await fs.writeFile(sectionsPath, payload, "utf8");
    await fs.writeFile(editorPath, JSON.stringify({ sections }, null, 2), "utf8");

    return Response.json({ ok: true, count: sections.length });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}
