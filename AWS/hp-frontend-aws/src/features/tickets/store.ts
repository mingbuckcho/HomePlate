"use client";

import { create } from "zustand";
import type { Ticket } from "@/entities/tickets/type";

type TicketState = {
  items: Ticket[];
  hydrate: () => void;
  add: (t: Omit<Ticket, "createdAtISO" | "status" | "cancelledAtISO">) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void; // (dev) 완전 삭제
  clear: () => void;
};

const STORAGE_KEY = "homeplate_tickets_v1";

function safeRead(): Ticket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Ticket[]).map((t) => {
      // 이전 버전 로컬스토리지 호환
      if (!t.status) return { ...t, status: "ACTIVE" };
      return t;
    });
  } catch {
    return [];
  }
}

function safeWrite(items: Ticket[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage 막혀도 앱 동작은 계속
  }
}

function nowISO() {
  return new Date().toISOString();
}

export const useTicketStore = create<TicketState>((set, get) => ({
  items: [],

  hydrate: () => {
    const items = safeRead();
    set({ items });
  },

  add: (t) => {
    const item: Ticket = { ...t, createdAtISO: nowISO(), status: "ACTIVE" };
    const next = [item, ...get().items];
    set({ items: next });
    safeWrite(next);
  },

  cancel: (id) => {
    const t = nowISO();
    const next = get().items.map((x): Ticket =>
      x.id === id && x.status !== "CANCELLED"
        ? { ...x, status: "CANCELLED", cancelledAtISO: t }
        : x,
    );
    set({ items: next });
    safeWrite(next);
  },

  remove: (id) => {
    const next = get().items.filter((x) => x.id !== id);
    set({ items: next });
    safeWrite(next);
  },

  clear: () => {
    set({ items: [] });
    safeWrite([]);
  },
}));
