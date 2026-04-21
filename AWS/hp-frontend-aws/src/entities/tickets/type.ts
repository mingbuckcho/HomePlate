export type TicketSeat = {
  seatId: string;
  label: string;
  price: number;
};

export type TicketGameSnapshot = {
  gid: string;
  awayTeam: string;
  homeTeam: string;
  stadium: string;
  gameAtISO: string;
};

export type Ticket = {
  id: string; // tid

  /** QR에 넣을 문자열 (백엔드에서 내려주면 사용, 없으면 id 사용) */
  qrPayload?: string;

  /** 예매자 이름(회원가입 이름) */
  buyerName?: string;

  /** 경기 정보 스냅샷(백엔드 붙기 전까지는 프론트에서 저장) */
  game?: TicketGameSnapshot;

  /** 구역/좌석 */
  zoneId?: string;
  seats: TicketSeat[];

  totalPrice: number;
  paymentMethod: "CARD" | "TOSS" | "KAKAO";

  createdAtISO: string;
  status: "ACTIVE" | "CANCELLED";
  cancelledAtISO?: string;
};
