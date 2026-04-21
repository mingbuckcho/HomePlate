"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AdminState = {
  isAdmin: boolean;
  login: (payload: { email: string; password: string }) => boolean;
  logout: () => void;
};

const KEY = "homeplate_admin_session_v1";
/** 백엔드 AdminInitializer와 동일 (이메일: admin, 비밀번호: pass123#) */
const ADMIN_EMAIL = "admin";
const ADMIN_PW = "pass123#";

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      isAdmin: false,
      login: ({ email, password }) => {
        const ok = email === ADMIN_EMAIL && password === ADMIN_PW;
        if (ok) set({ isAdmin: true });
        return ok;
      },
      logout: () => set({ isAdmin: false }),
    }),
    { name: KEY, storage: createJSONStorage(() => localStorage) },
  ),
);
