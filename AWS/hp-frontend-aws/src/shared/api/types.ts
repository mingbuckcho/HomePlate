/**
 * 백엔드 Swagger DTO와 맞춘 타입 (수정 금지: 백엔드 스펙 그대로)
 */

// --- Auth (AuthController) ---
export type SignUpRequest = {
  email: string;
  password: string;
  userName: string;
  phone: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  userName: string;
  /** 백엔드 Role (ROLE_ADMIN, ROLE_USER) */
  role: string;
};

// --- Info (InfoController) ---
export type GameResponse = {
  gameId: number;
  gameTitle: string;
  stadiumName: string;
  gameDate: string; // yyyy-MM-dd
  gameTime: string; // HH:mm
  homeName: string;
  homeLogo: string;
  awayName: string;
  awayLogo: string;
};

export type TeamRankingResponse = {
  rankingId: number;
  rankNo: number;
  played: number;
  win: number;
  loss: number;
  draw: number;
  winRate: number;
  gameBehind: number;
  teamName: string;
  teamLogo: string;
};

export type NewsResponse = {
  newsId: number;
  newsTitle: string;
  newsUrl: string;
  newsThumbnail: string | null;
  newsPress: string | null;
  publishedAt: string; // yyyy-MM-dd
};

export type GoodsResponse = {
  goodsId: number;
  goodsName: string;
  teamName: string;
  goodsPrice: number;
  goodsThumbnail: string | null;
  goodsUrl: string;
};

// --- Book (BookController) ---
export type ZoneStatus = "AVAILABLE" | "NEAR_SOLD_OUT" | "SOLD_OUT";

export type SeatResponse = {
  seatId: number;
  seatCode: string;
  seatRow: string;
  seatCol: number;
  isBooked: boolean;
};

export type ZoneResponse = {
  zoneId: string;
  status: ZoneStatus;
  totalSeats: number;
  bookedSeats: number;
  occupancyRate: number;
  seats: SeatResponse[];
};

export type OrderRequest = {
  gameId: number;
  seatCodes: string[];
};

export type PaymentRequest = {
  orderId: number;
};

// --- Mypage (MypgController) ---
export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";

export type OrderResponse = {
  orderId: number;
  gameTitle: string;
  stadiumName: string;
  gameDate: string;
  gameTime: string;
  zoneNumber: string;
  seatCode: string;
  qrCode: string;
  homeLogo?: string;
  orderStatus: OrderStatus;
  totalPrice?: number;
};

export type MyPageResponse = {
  activeOrders: OrderResponse[];
  inactiveOrders: OrderResponse[];
};

// --- Queue (QueueController) ---
export type QueueResponse = {
  status: string;
  rank: number | null;
};

// --- Chat (ChatController) ---
export type ChatRequest = {
  menuId: number;
  gameId?: number | null;
  zoneNumber?: string | null;
};

export type ChatResponse = {
  answer: string;
};

// --- Admin Games (AdminController GET /api/admin/games) ---
export type AdminGameResponse = {
  gameId: number;
  stadiumName: string;
  homeTeamName: string;
  awayTeamName: string;
  /** "yyyy-MM-dd HH:mm" */
  gameStartAt: string;
  /** "yyyy-MM-dd HH:mm" */
  ticketOpenAt: string;
  /** SCHEDULED | OPEN | ENDED */
  gameStatus: string;
  maxSeats: number;
};

export type PageAdminGames = {
  content: AdminGameResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
};

// --- Admin Outbox (AdminController GET /admin/history/outbox) ---
export type OutboxHistoryStatus = "SUCCESS" | "FAILURE";

export type OutboxHistoryItem = {
  historyId: number;
  orderId: number;
  userId: number;
  historyStatus: OutboxHistoryStatus;
  sentAt: string; // "yyyy-MM-dd HH:mm:ss"
};

export type PageOutboxHistory = {
  content: OutboxHistoryItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
};

// --- Error (GlobalExceptionHandler) ---
export type ErrorResponse = {
  time: string;
  status: number;
  error: string;
  code: string;
  message: string;
};
