"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-900">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-6 text-sm font-medium">
        <div className="flex gap-6">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Home
          </Link>
          <Link
            href="/cases"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Cases
          </Link>
          <Link
            href="/reports/weekly"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Reports
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <span className="text-gray-400 dark:text-gray-500">...</span>
          ) : session?.user ? (
            <>
              <span
                className="text-gray-600 dark:text-gray-400"
                title={session.user.email ?? undefined}
              >
                {session.user.name ?? session.user.email ?? "User"}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => signIn("keycloak", { callbackUrl: "/" })}
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              로그인
            </button>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
