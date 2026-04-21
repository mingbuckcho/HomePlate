"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Game } from "@/entities/game/type";
import { withComputedStatus } from "@/features/games/status";

export type GameInput = Omit<Game, "status">;

type GameState = {
  items: Game[];
  hydrated: boolean;

  hydrate: () => void;
  /** 백엔드에서 받은 목록으로 교체 (API 연동 시) */
  setItems: (items: Game[]) => void;
  list: () => Game[];
  listWithStatus: () => Game[];
  getById: (id: string) => Game | undefined;

  upsert: (g: GameInput) => void;
  remove: (id: string) => void;
  resetToSeed: () => void;
};

const STORAGE_KEY = "homeplate_games_v1";

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,

      hydrate: () => {
        if (!get().hydrated) set({ hydrated: true });
      },

      setItems: (items) => set({ items }),

      list: () => get().items,

      listWithStatus: () => get().items.map((g) => withComputedStatus(g)),

      getById: (id) => get().items.find((g) => g.id === id),

      upsert: (g) =>
        set((s) => {
          const next: Game = { ...g };
          const idx = s.items.findIndex((x) => x.id === g.id);
          const items = [...s.items];
          if (idx >= 0) items[idx] = next;
          else items.unshift(next);
          return { items };
        }),

      remove: (id) =>
        set((s) => ({ items: s.items.filter((x) => x.id !== id) })),

      resetToSeed: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
