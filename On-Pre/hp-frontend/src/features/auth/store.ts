"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AuthUser = {
  email: string;
  name?: string;
  phone?: string;
};

type AuthState = {
  isAuthed: boolean;
  user: AuthUser | null;
  /** 백엔드 로그인 시 발급 (Authorization Bearer). */
  accessToken: string | null;

  /** 백엔드 로그인 성공 시 호출 */
  setLogin: (payload: {
    accessToken: string;
    email: string;
    name?: string;
  }) => void;
  /** Refresh로 accessToken만 갱신 (user/isAuthed 유지) */
  setAccessToken: (accessToken: string) => void;
  /** 목업 로그인 (백엔드 미연동 시) */
  loginMock: (payload: { email: string; password: string }) => void;
  /** 목업 회원가입 (백엔드 미연동 시) */
  registerMock: (payload: {
    name: string;
    phone: string;
    email: string;
    password: string;
  }) => void;

  logout: () => void;
};

const STORAGE_KEY = "homeplate_auth_session_v1";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthed: false,
      user: null,
      accessToken: null,

      setLogin: ({ accessToken, email, name }) =>
        set({
          isAuthed: true,
          user: { email, name },
          accessToken,
        }),

      setAccessToken: (accessToken) => set({ accessToken }),

      loginMock: ({ email }) =>
        set({
          isAuthed: true,
          user: { email },
          accessToken: null,
        }),

      registerMock: ({ name, phone, email }) =>
        set({
          isAuthed: false,
          user: { name, phone, email },
          accessToken: null,
        }),

      logout: () => set({ isAuthed: false, user: null, accessToken: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        isAuthed: s.isAuthed,
        user: s.user,
        accessToken: s.accessToken,
      }),
    },
  ),
);
