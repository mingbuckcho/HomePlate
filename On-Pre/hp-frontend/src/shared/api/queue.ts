import { http } from "@/shared/api/http";
import type { QueueResponse } from "@/shared/api/types";

/**
 * Swagger: QueueController
 * - POST /queue/{gameId}
 * - GET /queue/{gameId}/rank
 */

export async function enterQueue(
  gameId: string | number,
): Promise<QueueResponse> {
  const { data } = await http.post<QueueResponse>(`/queue/${gameId}`);
  return data;
}

export async function getQueueRank(
  gameId: string | number,
): Promise<QueueResponse> {
  const { data } = await http.get<QueueResponse>(`/queue/${gameId}/rank`);
  return data;
}
