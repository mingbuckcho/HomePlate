import { promises as fs } from "node:fs";
import path from "node:path";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJsonIfExists(filepath: string): Promise<unknown | null> {
  try {
    const buf = await fs.readFile(filepath, "utf8");
    return JSON.parse(buf) as unknown;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stadiumId = searchParams.get("stadiumId");
  if (stadiumId !== "JAMSIL") {
    return Response.json({ sections: [] }, { status: 200 });
  }

  const root = process.cwd();
  const mapsDir = path.join(root, "src", "features", "ticketing", "maps");

  const editorPath = path.join(mapsDir, "jamsil.editor.json");
  const sectionsPath = path.join(mapsDir, "jamsil.sections.json");

  const editor = await readJsonIfExists(editorPath);
  if (isRecord(editor) && Array.isArray(editor.sections)) {
    return Response.json({ sections: editor.sections });
  }

  const sections = await readJsonIfExists(sectionsPath);
  if (Array.isArray(sections)) {
    return Response.json({ sections });
  }

  return Response.json({ sections: [] }, { status: 200 });
}
