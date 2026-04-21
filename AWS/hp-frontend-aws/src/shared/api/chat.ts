import { http } from "@/shared/api/http";
import type { ChatRequest, ChatResponse } from "@/shared/api/types";

/**
 * Swagger: ChatController
 * - POST /chat/ask
 *
 * menuId:
 *   1 = 예매방법
 *   2 = 환불규정
 *   3 = 구장별 좌석현황 (gameId, zoneNumber 필요)
 *   4 = 경기날 날씨조회 (gameId 필요)
 *   5 = 고객센터
 */
export async function askChatbot(request: ChatRequest): Promise<ChatResponse> {
  const { data } = await http.post<ChatResponse>("/chat/ask", request);
  return data;
}
