import { getApiBase } from "@/shared/api/client";
import { getMyOrders, cancelOrder } from "@/shared/api/mypage";
import { mapOrderResponseToTicket } from "@/shared/api/mappers";
import type { Ticket } from "@/entities/tickets/type";

/** 백엔드 /mypage/orders 사용. orderId=티켓 id로 사용. */
export async function fetchMyTickets(): Promise<Ticket[]> {
  if (!getApiBase()) return [];
  const res = await getMyOrders();
  return [
    ...res.activeOrders.map(mapOrderResponseToTicket),
    ...res.inactiveOrders.map(mapOrderResponseToTicket),
  ];
}

/** 백엔드 DELETE /mypage/orders/{orderId} 사용. ticketId는 orderId. */
export async function cancelTicket(ticketId: string): Promise<void> {
  if (!getApiBase()) return;
  await cancelOrder(Number(ticketId));
}
