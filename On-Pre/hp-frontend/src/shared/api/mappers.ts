import type { GameResponse, OrderResponse } from "@/shared/api/types";
import type { Game } from "@/entities/game/type";
import type { Ticket } from "@/entities/tickets/type";

/**
 * 백엔드 GameResponse → 프론트 Game
 * (Swagger 스펙: gameDate yyyy-MM-dd, gameTime HH:mm)
 */
export function mapGameResponseToGame(r: GameResponse): Game {
  const gameAtISO = `${r.gameDate}T${r.gameTime.length === 5 ? r.gameTime + ":00" : r.gameTime}+09:00`;
  return {
    id: String(r.gameId),
    awayTeam: r.awayName,
    homeTeam: r.homeName,
    stadium: r.stadiumName,
    gameAtISO,
    openAtISO: `${r.gameDate}T00:00:00+09:00`,
    bannerUrl: r.homeLogo || undefined,
    autoCloseEnabled: true,
  };
}

/**
 * 백엔드 OrderResponse → 프론트 Ticket (마이페이지 표시용)
 */
export function mapOrderResponseToTicket(o: OrderResponse): Ticket {
  const gameAtISO = `${o.gameDate}T${o.gameTime.length === 5 ? o.gameTime + ":00" : o.gameTime}+09:00`;
  const seatLabels = o.seatCode.split(",").map((s) => s.trim());
  const [awayTeam = "", homeTeam = ""] = o.gameTitle
    .split(/\s+vs\s+/i)
    .map((s) => s.trim());
  return {
    id: String(o.orderId),
    qrPayload: o.qrCode,
    game: {
      gid: "",
      awayTeam,
      homeTeam,
      stadium: o.stadiumName,
      gameAtISO,
    },
    zoneId: o.zoneNumber,
    seats: seatLabels.map((label, i) => ({
      seatId: String(i),
      label,
      price: 0,
    })),
    totalPrice: o.totalPrice != null ? Number(o.totalPrice) : 0,
    paymentMethod: "CARD",
    createdAtISO: gameAtISO,
    status:
      o.orderStatus === "PAID"
        ? "ACTIVE"
        : o.orderStatus === "CANCELLED"
          ? "CANCELLED"
          : "CANCELLED",
  };
}
