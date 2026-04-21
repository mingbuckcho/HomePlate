import { NextRequest, NextResponse } from "next/server";
import { pruneExpired, listClaimed } from "@/app/api/booking/store";

/**
 * GET: 해당 경기/구역에서 현재 예약된(다른 사람이 결제 진행 중인) 좌석 ID 목록
 * query: gameId, zoneId
 * 응답: { seatIds: string[] }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const zoneId = searchParams.get("zoneId");
  if (!gameId || !zoneId) {
    return NextResponse.json(
      { error: "gameId, zoneId required" },
      { status: 400 },
    );
  }

  pruneExpired();
  const seatIds = [...listClaimed(gameId, zoneId)];

  return NextResponse.json({ seatIds });
}
