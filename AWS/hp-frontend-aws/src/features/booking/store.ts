import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** 구역 선택 → 좌석 선택 → 결제 완료까지 주어지는 총 시간(초) */
export const BOOKING_LOCK_SEC = 300; // 5분

const BOOKING_STORAGE_KEY = "homeplate_booking_v1";

export type SelectedSeat = {
  seatId: string;
  label: string; // 예: "A-01"
  price: number;
};

type LockState = {
  expiresInSec: number;
  startedAtMs: number;
};

export function getBookingRemainingSec(lock: LockState | null): number | null {
  if (!lock) return null;
  const elapsed = (Date.now() - lock.startedAtMs) / 1000;
  return Math.max(0, Math.floor(lock.expiresInSec - elapsed));
}

type BookingState = {
  gameId: string | null;
  zoneId: string | null;

  selectedSeats: SelectedSeat[];
  lock: LockState | null;

  setGame: (gameId: string) => void;
  setZone: (zoneId: string) => void;

  toggleSeat: (
    seat: SelectedSeat,
    max: number,
  ) => { ok: boolean; reason?: string };
  clearSeats: () => void;
  removeSeatsById: (seatIds: string[]) => void;

  startLock: (expiresInSec: number) => void;
  clearAll: () => void;
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      gameId: null,
      zoneId: null,
      selectedSeats: [],
      lock: null,

      setGame: (gameId) => set({ gameId }),
      setZone: (zoneId) => set({ zoneId }),

      toggleSeat: (seat, max) => {
        const cur = get().selectedSeats;
        const exists = cur.some((s) => s.seatId === seat.seatId);

        if (exists) {
          set({ selectedSeats: cur.filter((s) => s.seatId !== seat.seatId) });
          return { ok: true };
        }

        if (cur.length >= max)
          return { ok: false, reason: `최대 ${max}매까지 선택할 수 있어요.` };

        set({ selectedSeats: [...cur, seat] });
        return { ok: true };
      },

      clearSeats: () => set({ selectedSeats: [] }),

      removeSeatsById: (seatIds) =>
        set((state) => ({
          selectedSeats: state.selectedSeats.filter(
            (s) => !seatIds.includes(s.seatId),
          ),
        })),

      startLock: (expiresInSec) =>
        set({ lock: { expiresInSec, startedAtMs: Date.now() } }),

      clearAll: () =>
        set({
          gameId: null,
          zoneId: null,
          selectedSeats: [],
          lock: null,
        }),
    }),
    {
      name: BOOKING_STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return sessionStorage;
      }),
      partialize: (state) => ({
        gameId: state.gameId,
        zoneId: state.zoneId,
        selectedSeats: state.selectedSeats,
        lock: state.lock,
      }),
    },
  ),
);
