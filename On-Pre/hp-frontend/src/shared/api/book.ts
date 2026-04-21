import { http } from "@/shared/api/http";
import type {
  ZoneResponse,
  OrderRequest,
  PaymentRequest,
} from "@/shared/api/types";
import type { ErrorResponse } from "@/shared/api/types";

/**
 * Swagger: BookController
 * - GET /book/{gameId}/zones/{zoneNumber}
 * - POST /book/{gameId}/seats/lock (body: string[] seatCodes)
 * - POST /book/orders (body: OrderRequest)
 * - POST /book/payment (body: PaymentRequest)
 */

export async function getZoneSeats(
  gameId: string | number,
  zoneNumber: string,
): Promise<ZoneResponse> {
  const { data } = await http.get<ZoneResponse>(
    `/book/${gameId}/zones/${zoneNumber}`,
  );
  return data;
}

export type LockResult = { ok: true } | { ok: false; message: string };

export async function lockSeats(
  gameId: string | number,
  seatCodes: string[],
): Promise<LockResult> {
  try {
    await http.post(`/book/${gameId}/seats/lock`, seatCodes);
    return { ok: true };
  } catch (err: unknown) {
    const axErr = err as {
      response?: { status: number; data?: ErrorResponse | ArrayBuffer };
    };
    const status = axErr.response?.status;
    let body = axErr.response?.data;
    // 에러 응답이 arraybuffer로 올 수 있음 (transformResponse 스킨 경우 등)
    if (body instanceof ArrayBuffer && body.byteLength > 0) {
      try {
        const json = JSON.parse(
          new TextDecoder("utf-8").decode(body),
        ) as ErrorResponse;
        body = json;
      } catch {
        body = undefined;
      }
    }
    const msg =
      body && typeof body === "object" && "message" in body
        ? (body as ErrorResponse).message
        : undefined;
    if (status === 403) {
      return {
        ok: false,
        message:
          msg ??
          "해당 경기 대기열을 통과한 뒤 좌석을 선택해 주세요. (예매 오픈 후 대기열 입장이 필요합니다.)",
      };
    }
    if (status === 409 || status === 400) {
      return {
        ok: false,
        message:
          msg ||
          "이미 선택된 좌석이거나 요청이 유효하지 않습니다. 해당 구장·구역의 좌석 데이터가 백엔드 DB에 등록되어 있어야 합니다.",
      };
    }
    if (axErr.response) {
      return {
        ok: false,
        message: msg ?? "좌석 선점에 실패했습니다.",
      };
    }
    return {
      ok: false,
      message:
        "서버에 연결할 수 없습니다. 다시 시도해 주세요. (백엔드 실행 여부, 주소(NEXT_PUBLIC_API_BASE_URL), 대기열 입장 여부를 확인하세요.)",
    };
  }
}

export async function createOrder(
  gameId: number,
  seatCodes: string[],
): Promise<number> {
  const body: OrderRequest = { gameId, seatCodes };
  const { data } = await http.post<number>("/book/orders", body);
  return data;
}

/** 가상 결제. 백엔드가 문자열 본문을 주면 파싱 에러가 나지 않도록 raw로 받는다. */
export async function payment(orderId: number): Promise<void> {
  await http.request({
    method: "POST",
    url: "/book/payment",
    data: { orderId } as PaymentRequest,
    responseType: "arraybuffer",
    transformResponse: [(d: unknown) => d],
  });
}
