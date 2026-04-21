"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { useAdminStore } from "@/features/admin/store";
import { useGameStore } from "@/features/games/store";
import type { Game, ForcedStatus } from "@/entities/game/type";
import { computeGameStatus } from "@/features/games/status";
import { fromKstIso, toKstIso } from "@/shared/utils/datetime";
import { cn } from "@/shared/utils/cn";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { Logo } from "@/shared/ui/Logo";
import { getApiBase, getAccessToken } from "@/shared/api/client";
import { login as loginApi, logout as logoutApi } from "@/shared/api/auth";
import { useAuthStore } from "@/features/auth/store";
import { mapGameResponseToGame } from "@/shared/api/mappers";
import {
  createGame,
  updateGame,
  deleteGame,
  getAdminGameList,
  VALID_STADIUM_IDS,
  STADIUM_FULLNAME_TO_ID,
  TEAM_NAME_TO_ID,
  ADMIN_TEAM_OPTIONS,
  ADMIN_STADIUM_OPTIONS,
} from "@/shared/api/admin";
import { ThemeSelect } from "@/shared/ui/ThemeSelect";

const FORCE_OPTIONS: Array<{ label: string; value: "" | ForcedStatus }> = [
  { label: "자동", value: "" },
  { label: "매진", value: "매진" },
  { label: "종료", value: "종료" },
  { label: "우천 취소", value: "우천취소" },
];

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold text-[var(--text-muted)]">
      {children}
    </div>
  );
}

export default function AdminPage() {
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const adminLogin = useAdminStore((s) => s.login);
  const logoutAdmin = useAdminStore((s) => s.logout);
  const logoutAuth = useAuthStore((s) => s.logout);
  const setAuthLogin = useAuthStore((s) => s.setLogin);

  const hydrate = useGameStore((s) => s.hydrate);
  const items = useGameStore((s) => s.items);
  const setItems = useGameStore((s) => s.setItems);
  const upsert = useGameStore((s) => s.upsert);
  const remove = useGameStore((s) => s.remove);
  const resetToSeed = useGameStore((s) => s.resetToSeed);

  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!getApiBase()) hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (getApiBase()) {
      getAdminGameList()
        .then((list) => setItems(list.map(mapGameResponseToGame)))
        .catch(() => {});
    }
  }, [setItems]);

  const [email, setEmail] = useState("admin");
  const [pw, setPw] = useState("1234");
  const [err, setErr] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const games = items;
  const [editingId, setEditingId] = useState<string | null>(null);

  const currentEditing = useMemo(() => {
    if (!editingId) return null;
    return games.find((g) => g.id === editingId) ?? null;
  }, [editingId, games]);

  const base = currentEditing ?? null;

  const [gid, setGid] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [stadium, setStadium] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [gameTime, setGameTime] = useState("18:30");
  const [openDate, setOpenDate] = useState("");
  const [openTime, setOpenTime] = useState("11:00");
  const [bannerUrl, setBannerUrl] = useState("");
  const [forcedStatus, setForcedStatus] = useState<"" | ForcedStatus>("");
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(true);

  // 한글이 깨져서 API가 "LG íŠ¸¡œ ìŠ¤" 같이 오면 TEAM_NAME_TO_ID 매칭 실패 → 팀 ID로 시작하는지로 보정
  const homeTeamIdFromBase = (): string => {
    if (!base?.homeTeam) return "";
    const byName = TEAM_NAME_TO_ID[base.homeTeam];
    if (byName) return byName;
    const byPrefix = ADMIN_TEAM_OPTIONS.find((o) =>
      base.homeTeam?.startsWith(o.value),
    )?.value;
    return byPrefix ?? base.homeTeam ?? "";
  };
  const awayTeamIdFromBase = (): string => {
    if (!base?.awayTeam) return "";
    const byName = TEAM_NAME_TO_ID[base.awayTeam];
    if (byName) return byName;
    const byPrefix = ADMIN_TEAM_OPTIONS.find((o) =>
      base.awayTeam?.startsWith(o.value),
    )?.value;
    return byPrefix ?? base.awayTeam ?? "";
  };
  const stadiumIdFromBase = (): string => {
    if (!base?.stadium) return "";
    const byName = STADIUM_FULLNAME_TO_ID[base.stadium];
    if (byName) return byName;
    const byIdInText = ADMIN_STADIUM_OPTIONS.find((s) =>
      base.stadium?.includes(s.value),
    )?.value;
    const raw = byIdInText ?? base.stadium ?? "";
    // 한글 깨짐 등으로 유효 ID가 아니면 비워서 사용자가 구장을 다시 선택하게 함
    return VALID_STADIUM_IDS.has(raw) ? raw : "";
  };

  useEffect(() => {
    if (!base) return;
    setGid(base.id);
    setHomeTeam(homeTeamIdFromBase());
    setAwayTeam(awayTeamIdFromBase());
    setStadium(stadiumIdFromBase());
    const g = fromKstIso(base.gameAtISO);
    const o = fromKstIso(base.openAtISO);
    setGameDate(g.date);
    setGameTime(g.time);
    setOpenDate(o.date);
    setOpenTime(o.time);
    setBannerUrl(base.bannerUrl?.replace(/^\/game-banner\//, "") ?? "");
    setForcedStatus((base.forcedStatus ?? "") as "" | ForcedStatus);
    setAutoCloseEnabled(base.autoCloseEnabled !== false);
  }, [base]);

  const resetForm = () => {
    setEditingId(null);
    setGid("");
    setHomeTeam("");
    setAwayTeam("");
    setStadium("");
    setGameDate("");
    setGameTime("18:30");
    setOpenDate("");
    setOpenTime("11:00");
    setBannerUrl("");
    setForcedStatus("");
    setAutoCloseEnabled(true);
  };

  if (!isAdmin) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-14"
        style={{ background: "var(--page-bg)", color: "var(--text-primary)" }}
      >
        <div className="mx-auto w-full max-w-[420px]">
          <div className="flex justify-center">
            <Logo />
          </div>
          <p className="mt-4 text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            Admin
          </p>
          <p className="mt-1 text-center text-sm text-[var(--text-muted)]">
            관리자 로그인
          </p>

          <div className="mt-8 rounded-3xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-8 shadow-lg">
            {err ? (
              <div className="mb-4 rounded-2xl border border-[var(--accent)] bg-[var(--accent-muted)] px-4 py-3 text-sm font-medium text-[var(--accent)]">
                {err}
              </div>
            ) : null}

            <FieldLabel>이메일</FieldLabel>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base mt-1.5 h-12 w-full rounded-2xl px-4 text-sm"
              placeholder="admin"
            />

            <div className="mt-4">
              <FieldLabel>비밀번호</FieldLabel>
              <input
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
                className="input-base mt-1.5 h-12 w-full rounded-2xl px-4 text-sm"
                placeholder="1234"
              />
            </div>

            <button
              type="button"
              disabled={loginLoading}
              onClick={async () => {
                setErr(null);
                if (getApiBase()) {
                  setLoginLoading(true);
                  try {
                    const res = await loginApi({ email, password: pw });
                    setAuthLogin({
                      accessToken: res.accessToken,
                      email,
                      name: res.userName,
                    });
                    adminLogin({ email, password: pw });
                  } catch (e: unknown) {
                    const msg = (
                      e as { response?: { data?: { message?: string } } }
                    )?.response?.data?.message;
                    setErr(
                      msg ??
                        "로그인에 실패했습니다. 이메일·비밀번호를 확인하세요.",
                    );
                  } finally {
                    setLoginLoading(false);
                  }
                } else {
                  const ok = adminLogin({ email, password: pw });
                  if (!ok) setErr("관리자 계정 정보가 올바르지 않습니다.");
                }
              }}
              className="mt-6 h-12 w-full rounded-2xl bg-[var(--accent)] text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loginLoading ? "로그인 중…" : "로그인"}
            </button>

            <div className="mt-4 text-center text-xs text-[var(--text-muted)]">
              <Link href="/" className="hover:underline">
                홈으로 돌아가기 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const computedStatus = (g: Game) => computeGameStatus(g);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--page-bg)", color: "var(--text-primary)" }}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--page-bg)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Logo />
            <span className="text-[var(--text-muted)]">ADMIN</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/admin/outbox"
              className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-hover)]"
            >
              발송 이력
            </Link>
            <Link
              href="/"
              className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-hover)]"
            >
              홈
            </Link>
            <button
              type="button"
              onClick={() => {
                if (confirm("시드 데이터로 초기화할까요?")) resetToSeed();
              }}
              className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-hover)]"
            >
              시드로 초기화
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await logoutApi();
                } catch {
                  /* 무시 */
                }
                logoutAdmin();
                logoutAuth();
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-hover)]"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
          <div className="rounded-3xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Fixture
                </p>
                <div className="mt-1 text-lg font-black text-[var(--text-primary)]">
                  {editingId ? "경기 수정" : "경기 생성"}
                </div>
              </div>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-[var(--text-muted)] hover:underline"
                >
                  새로 만들기 →
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3">
              <div>
                <FieldLabel>GID (관리자 입력)</FieldLabel>
                <input
                  value={gid}
                  onChange={(e) => setGid(e.target.value)}
                  placeholder="g-20260328-LG-KT"
                  className="input-base mt-1 h-9 w-full rounded-lg px-3 text-sm"
                  disabled={!!editingId}
                />
                {editingId ? (
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    수정 시 GID는 변경할 수 없어요.
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>원정(away)</FieldLabel>
                  <ThemeSelect
                    value={awayTeam}
                    onChange={setAwayTeam}
                    options={ADMIN_TEAM_OPTIONS}
                    placeholder="팀 선택"
                    className="mt-1"
                    aria-label="원정 팀 선택"
                  />
                </div>
                <div>
                  <FieldLabel>홈(home)</FieldLabel>
                  <ThemeSelect
                    value={homeTeam}
                    onChange={setHomeTeam}
                    options={ADMIN_TEAM_OPTIONS}
                    placeholder="팀 선택"
                    className="mt-1"
                    aria-label="홈 팀 선택"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>구장</FieldLabel>
                <ThemeSelect
                  value={stadium}
                  onChange={setStadium}
                  options={ADMIN_STADIUM_OPTIONS}
                  placeholder="구장 선택"
                  className="mt-1"
                  aria-label="구장 선택"
                />
                {editingId && !stadium ? (
                  <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    구장이 자동 선택되지 않았습니다. 위에서 구장을 선택해
                    주세요.
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>경기 날짜</FieldLabel>
                  <input
                    type="date"
                    value={gameDate}
                    onChange={(e) => setGameDate(e.target.value)}
                    className="input-base mt-1 h-9 w-full rounded-lg px-2 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel>경기 시간</FieldLabel>
                  <input
                    type="time"
                    value={gameTime}
                    onChange={(e) => setGameTime(e.target.value)}
                    className="input-base mt-1 h-9 w-full rounded-lg px-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>예매 오픈 날짜</FieldLabel>
                  <input
                    type="date"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    className="input-base mt-1 h-9 w-full rounded-lg px-2 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel>예매 오픈 시간</FieldLabel>
                  <input
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="input-base mt-1 h-9 w-full rounded-lg px-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>배너 이미지 (game-banner 폴더)</FieldLabel>
                <input
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="input-base mt-1 h-9 w-full rounded-lg px-3 text-sm"
                  placeholder="파일명.png"
                />
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  public/game-banner/ 안에 넣은 파일명만 입력 →
                  /game-banner/파일명.png 로 사용
                </div>
              </div>

              {editingId ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>종료 방식 (수정 시에만)</FieldLabel>
                    <ThemeSelect
                      value={forcedStatus}
                      onChange={(v) => setForcedStatus(v as "" | ForcedStatus)}
                      options={FORCE_OPTIONS}
                      placeholder="자동"
                      className="mt-1"
                      aria-label="종료 방식 선택"
                    />
                  </div>
                  <div>
                    <FieldLabel>자동 종료</FieldLabel>
                    <label className="input-base mt-1 flex h-9 w-full items-center justify-between rounded-lg px-3 text-sm">
                      <span className="text-[var(--text-secondary)]">
                        {autoCloseEnabled ? "ON" : "OFF"}
                      </span>
                      <input
                        type="checkbox"
                        checked={autoCloseEnabled}
                        onChange={(e) => setAutoCloseEnabled(e.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>
                    <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      경기 시작 24시간 전부터 "종료"로 표시
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                disabled={submitLoading}
                onClick={async () => {
                  if (!homeTeam.trim() || !awayTeam.trim())
                    return alert("홈/원정 팀을 입력해 주세요.");
                  if (!stadium.trim()) return alert("구장을 선택해 주세요.");
                  if (getApiBase() && !VALID_STADIUM_IDS.has(stadium.trim()))
                    return alert(
                      "구장을 목록에서 선택해 주세요. (잘못된 값이면 수정 시 구장을 다시 선택하세요.)",
                    );
                  if (!gameDate || !gameTime)
                    return alert("경기 일시를 입력해 주세요.");
                  if (!openDate || !openTime)
                    return alert("예매 오픈 일시를 입력해 주세요.");

                  if (getApiBase()) {
                    if (!getAccessToken()) {
                      alert(
                        "관리자 API는 로그인 후 이용할 수 있습니다. 로그인 페이지에서 관리자(이메일: admin, 비밀번호: 1234)로 로그인한 뒤 다시 시도하세요.",
                      );
                      return;
                    }
                    setSubmitLoading(true);
                    try {
                      const body = {
                        stadiumId: stadium.trim(),
                        homeTeamId: homeTeam.trim(),
                        awayTeamId: awayTeam.trim(),
                        gameStartAt: `${gameDate} ${gameTime}`,
                        ticketOpenAt: `${openDate} ${openTime}`,
                        maxSeats: 5000,
                      };
                      if (editingId) {
                        const numId = Number(editingId);
                        if (!Number.isFinite(numId))
                          throw new Error("잘못된 경기 ID");
                        await updateGame(numId, body);
                        const list = await getAdminGameList();
                        setItems(list.map(mapGameResponseToGame));
                        resetForm();
                        alert("수정되었습니다.");
                      } else {
                        const newId = await createGame(body);
                        const list = await getAdminGameList();
                        setItems(list.map(mapGameResponseToGame));
                        resetForm();
                        alert(
                          `경기 생성 완료 (ID: ${newId}). 목록이 갱신되었습니다.`,
                        );
                      }
                    } catch (e: unknown) {
                      const err = e as {
                        response?: {
                          status?: number;
                          data?: { message?: string };
                        };
                      };
                      const msg =
                        err?.response?.data?.message ??
                        "경기 생성/수정에 실패했습니다.";
                      const sent = `전송한 ID: stadiumId="${stadium.trim()}", homeTeamId="${homeTeam.trim()}", awayTeamId="${awayTeam.trim()}"`;
                      alert(
                        `${msg}\n\n${sent}\n\n→ 해결: 백엔드가 쓰는 MySQL DB(기본 HomePlate)에서 docs/run-this-once.sql 을 실행하세요. (USE HomePlate; 후 파일 내용 실행)\n\n또는 docs/data.sql 을 hp-backend-main/api/src/main/resources/data.sql 로 복사한 뒤 백엔드를 재시작하세요.`,
                      );
                    } finally {
                      setSubmitLoading(false);
                    }
                    return;
                  }

                  if (!gid.trim()) return alert("GID를 입력해 주세요.");
                  const rawBanner = bannerUrl.trim();
                  const next: Game = {
                    id: gid.trim(),
                    homeTeam: homeTeam.trim(),
                    awayTeam: awayTeam.trim(),
                    stadium: stadium.trim(),
                    gameAtISO: toKstIso(gameDate, gameTime),
                    openAtISO: toKstIso(openDate, openTime),
                    bannerUrl: rawBanner
                      ? rawBanner.startsWith("/")
                        ? rawBanner
                        : `/game-banner/${rawBanner}`
                      : undefined,
                    forcedStatus: forcedStatus || "",
                    autoCloseEnabled,
                  };
                  upsert(next);
                  alert(editingId ? "수정되었습니다." : "생성되었습니다.");
                  resetForm();
                }}
                className="h-10 w-full rounded-lg bg-[var(--accent)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitLoading
                  ? "처리 중…"
                  : editingId
                    ? "수정 저장"
                    : "경기 생성"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-[var(--text-primary)]">
                경기 목록
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                총 {games.length}개
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {games.map((g) => {
                const st = computedStatus(g);
                const gAt = fromKstIso(g.gameAtISO);
                const oAt = fromKstIso(g.openAtISO);

                return (
                  <div
                    key={g.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--text-primary)]">
                          {g.awayTeam}{" "}
                          <span className="text-[var(--text-muted)]">vs</span>{" "}
                          {g.homeTeam}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                          경기: {gAt.date} {gAt.time} · {g.stadium}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                          오픈: {oAt.date} {oAt.time}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              st === "예매오픈" &&
                                "bg-[var(--accent)] text-white",
                              (st === "예매전" ||
                                st === "매진" ||
                                st === "종료" ||
                                st === "우천취소") &&
                                "bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]",
                            )}
                          >
                            {st}
                          </span>
                          {g.forcedStatus ? (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              강제: {g.forcedStatus}
                            </span>
                          ) : null}
                          {g.autoCloseEnabled === false ? (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              자동종료 OFF
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Link
                          href={`/games/${g.id}`}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--surface-hover)]"
                        >
                          상세
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEditingId(g.id)}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--surface-hover)]"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`${g.id} 경기를 삭제할까요?`)) return;
                            if (getApiBase()) {
                              const numId = Number(g.id);
                              if (!Number.isFinite(numId)) return;
                              try {
                                await deleteGame(numId);
                                const list = await getAdminGameList();
                                setItems(list.map(mapGameResponseToGame));
                                alert("삭제되었습니다.");
                              } catch (e: unknown) {
                                const err = e as {
                                  response?: {
                                    data?: { message?: string } | string;
                                  };
                                };
                                const msg =
                                  typeof err?.response?.data === "string"
                                    ? err.response.data
                                    : (err?.response?.data?.message ??
                                      "삭제에 실패했습니다.");
                                alert(msg);
                                const list = await getAdminGameList();
                                setItems(list.map(mapGameResponseToGame));
                              }
                            } else {
                              remove(g.id);
                            }
                          }}
                          className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent)] hover:opacity-80"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {games.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--page-bg)] p-8 text-center text-sm text-[var(--text-muted)]">
                  경기가 없습니다. 왼쪽 폼에서 경기를 생성해 주세요.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
