import { NextRequest, NextResponse } from "next/server";
import {
  RESERVE_TTL_MS,
  pruneExpired,
  getEntry,
  setEntry,
} from "@/app/api/booking/store";

/**
 * POST: 좌석 예약 시도. 먼저 결제로 넘어간 사람이 해당 좌석을 가져감.
 * body: { gameId, zoneId, seatIds: string[], sessionId: string }
 * 200: 예약 성공
 * 409: 일부/전부 이미 다른 세션에 의해 예약됨 → takenSeats 반환
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, zoneId, seatIds, sessionId } = body as {
      gameId?: string;
      zoneId?: string;
      seatIds?: string[];
      sessionId?: string;
    };
    if (
      typeof gameId !== "string" ||
      typeof zoneId !== "string" ||
      !Array.isArray(seatIds) ||
      typeof sessionId !== "string"
    ) {
      return NextResponse.json(
        { error: "gameId, zoneId, seatIds, sessionId required" },
        { status: 400 },
      );
    }

    pruneExpired();
    const now = Date.now();
    const expiresAt = now + RESERVE_TTL_MS;
    const takenSeats: string[] = [];

    for (const seatId of seatIds) {
      const existing = getEntry(gameId, zoneId, seatId);
      if (
        existing &&
        existing.expiresAt > now &&
        existing.sessionId !== sessionId
      ) {
        takenSeats.push(seatId);
      }
    }

    if (takenSeats.length > 0) {
      return NextResponse.json({ takenSeats }, { status: 409 });
    }

    for (const seatId of seatIds) {
      setEntry(gameId, zoneId, seatId, { sessionId, expiresAt });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad request" },
      { status: 400 },
    );
  }
}
