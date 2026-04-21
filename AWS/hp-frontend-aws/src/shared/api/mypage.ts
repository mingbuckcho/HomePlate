import { http } from "@/shared/api/http";
import type { MyPageResponse } from "@/shared/api/types";

/**
 * Swagger: MypgController
 * - GET /mypage/orders
 * - DELETE /mypage/orders/{orderId}
 */

export async function getMyOrders(): Promise<MyPageResponse> {
  const { data } = await http.get<MyPageResponse>("/mypage/orders");
  return data;
}

/** 예매 취소. 백엔드가 문자열 본문을 줄 수 있어 파싱 에러가 나지 않도록 raw로 받는다. */
export async function cancelOrder(orderId: number): Promise<void> {
  await http.request({
    method: "DELETE",
    url: `/mypage/orders/${orderId}`,
    responseType: "arraybuffer",
    transformResponse: [(d: unknown) => d],
  });
}
