"use client";

import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};

type NotificationState = {
  toasts: Toast[];
  add: (type: ToastType, message: string) => void;
  remove: (id: string) => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  add: (type, message) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: `t-${Date.now()}`, type, message, createdAt: Date.now() },
      ],
    })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
