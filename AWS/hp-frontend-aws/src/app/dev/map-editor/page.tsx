"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type SeatTierId =
  | "premium"
  | "exciting"
  | "purple"
  | "blue"
  | "orange"
  | "red"
  | "navy"
  | "green";

type Point = [number, number]; // 0~100 (%)
type Section = { id: string; tier: SeatTierId; points: Point[] };

const TIERS: SeatTierId[] = [
  "premium",
  "exciting",
  "purple",
  "blue",
  "orange",
  "red",
  "navy",
  "green",
];

const IMG_SRC = "/assets/stadium/jamsil-map.png";
const LS_KEY = "HOMEPLATE_MAP_EDITOR_JAMSIL_v1";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

async function saveToFile(sections: Section[]) {
  const res = await fetch("/api/dev/map-editor/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stadiumId: "JAMSIL", sections }),
  });
  if (!res.ok) throw new Error("save failed");
  return (await res.json()) as unknown;
}

async function loadFromFile(): Promise<Section[]> {
  const res = await fetch("/api/dev/map-editor/load?stadiumId=JAMSIL");
  if (!res.ok) return [];
  const json = (await res.json()) as { sections?: unknown };
  return Array.isArray(json.sections) ? (json.sections as Section[]) : [];
}

export default function MapEditorPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [sectionId, setSectionId] = useState("224");
  const [tier, setTier] = useState<SeatTierId>("orange");

  const [points, setPoints] = useState<Point[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [autoSaveFile, setAutoSaveFile] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");

  const saveTimerRef = useRef<number | null>(null);

  const canSave = sectionId.trim().length > 0 && points.length >= 3;

  // 1) 최초 로드: 파일 -> localStorage fallback
  useEffect(() => {
    (async () => {
      const fromFile = await loadFromFile();
      if (fromFile.length > 0) {
        setSections(fromFile);
        localStorage.setItem(LS_KEY, JSON.stringify(fromFile));
        return;
      }
      const fromLs = localStorage.getItem(LS_KEY);
      if (fromLs) {
        try {
          const parsed = JSON.parse(fromLs) as Section[];
          if (Array.isArray(parsed)) setSections(parsed);
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  // 2) sections가 바뀌면 localStorage 저장 + (옵션) 파일 자동 저장(디바운스)
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(sections));

    if (!autoSaveFile) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    queueMicrotask(() => setStatus("saving"));

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await saveToFile(sections);
        setStatus("saved");
        setLastSavedAt(new Date().toLocaleTimeString());
      } catch {
        setStatus("error");
      }
    }, 450);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [sections, autoSaveFile]);

  function onClickOverlay(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPoints((prev) => [...prev, [round1(x), round1(y)]]);
  }

  function undo() {
    setPoints((prev) => prev.slice(0, -1));
  }

  function clearPoints() {
    setPoints([]);
  }

  function addSection() {
    if (!canSave) return;
    const id = sectionId.trim();

    setSections((prev) => {
      // 같은 id 있으면 덮어쓰기(업데이트)
      const rest = prev.filter((s) => s.id !== id);
      return [...rest, { id, tier, points }];
    });

    setPoints([]);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  async function manualSave() {
    setStatus("saving");
    try {
      await saveToFile(sections);
      setStatus("saved");
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch {
      setStatus("error");
    }
  }

  const exportOneLine = useMemo(() => JSON.stringify(sections), [sections]);

  async function copyOneLine() {
    await navigator.clipboard.writeText(exportOneLine);
    alert("한 줄 JSON 복사 완료");
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(sections, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jamsil.sections.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 text-white">
      <div className="text-2xl font-black">좌석도 폴리곤 에디터 (잠실)</div>
      <div className="mt-2 text-sm text-white/60">
        클릭으로 점 찍고(3개 이상) → 섹션 저장하면 자동으로 파일에 저장돼요.
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoSaveFile}
            onChange={(e) => setAutoSaveFile(e.target.checked)}
          />
          파일 자동 저장
        </label>

        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
          onClick={manualSave}
          disabled={sections.length === 0}
        >
          지금 저장
        </button>

        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
          onClick={downloadJson}
          disabled={sections.length === 0}
        >
          JSON 다운로드
        </button>

        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
          onClick={copyOneLine}
          disabled={sections.length === 0}
        >
          한 줄로 복사
        </button>

        <div className="ml-auto text-xs text-white/70">
          상태:{" "}
          <b className="text-white">
            {status === "idle" && "대기"}
            {status === "saving" && "저장중…"}
            {status === "saved" && `저장됨(${lastSavedAt})`}
            {status === "error" && "저장 실패(권한/경로 확인)"}
          </b>
        </div>
      </div>

      <div className="mt-2 text-xs text-white/60">
        저장 위치:{" "}
        <b className="text-white/80">
          src/features/ticketing/maps/jamsil.sections.json
        </b>{" "}
        (앱 반영용) /{" "}
        <b className="text-white/80">
          src/features/ticketing/maps/jamsil.editor.json
        </b>{" "}
        (에디터 복구용)
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left */}
        <div className="rounded-2xl border border-white/10 bg-black p-4">
          <div
            ref={wrapRef}
            className="relative w-full overflow-hidden rounded-xl border border-white/10"
          >
            <div className="relative aspect-square w-full">
              <Image src={IMG_SRC} alt="jamsil map" fill sizes="100vw" className="object-contain" priority />
            </div>

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              onClick={onClickOverlay}
            >
              {points.length >= 2 && (
                <polyline
                  points={points.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="0.4"
                />
              )}
              {points.length >= 3 && (
                <polygon
                  points={points.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill="rgba(255,255,255,0.12)"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="0.4"
                />
              )}

              {points.map(([x, y], idx) => (
                <g key={idx}>
                  <circle cx={x} cy={y} r={0.7} fill="rgba(255,80,80,0.95)" />
                  <text x={x + 0.8} y={y + 0.8} fontSize="2.8" fill="rgba(255,255,255,0.9)">
                    {idx + 1}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
              onClick={undo}
              disabled={points.length === 0}
            >
              Undo
            </button>
            <button
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-40"
              onClick={clearPoints}
              disabled={points.length === 0}
            >
              Clear
            </button>
            <button
              className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm hover:bg-emerald-500/25 disabled:opacity-40"
              onClick={addSection}
              disabled={!canSave}
            >
              섹션 저장(덮어쓰기)
            </button>

            <div className="ml-auto text-sm text-white/70">
              points: <b className="text-white">{points.length}</b>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="rounded-2xl border border-white/10 bg-black p-4">
          <div className="text-lg font-bold">섹션 정보</div>

          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm">
              구역 번호(id)
              <input
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/25"
                placeholder="예: 224"
              />
            </label>

            <label className="grid gap-1 text-sm">
              티어(tier)
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as SeatTierId)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/25"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              저장 조건: id 입력 + 꼭짓점 3개 이상
              <br />
              좌표는 0~100%라서 이미지 크기가 바뀌어도 유지돼요.
            </div>
          </div>

          <div className="mt-6 text-sm font-bold">저장된 섹션 ({sections.length})</div>
          <div className="mt-2 max-h-[420px] space-y-2 overflow-auto pr-1">
            {sections
              .slice()
              .sort((a, b) => a.id.localeCompare(b.id, "ko"))
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {s.id} <span className="text-white/60">({s.tier})</span>
                    </div>
                    <div className="text-xs text-white/60">points: {s.points.length}</div>
                  </div>
                  <button
                    className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                    onClick={() => removeSection(s.id)}
                  >
                    삭제
                  </button>
                </div>
              ))}

            {sections.length === 0 && (
              <div className="text-sm text-white/50">
                아직 저장된 섹션이 없어요. 왼쪽에서 찍고 “섹션 저장” 눌러봐요.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 text-xs font-semibold text-white/70">한 줄 JSON</div>
            <pre className="max-h-[160px] overflow-auto text-xs text-white/70">
{exportOneLine}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
