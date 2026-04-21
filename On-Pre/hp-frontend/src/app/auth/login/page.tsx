"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card } from "@/shared/ui/Card";
import { Container } from "@/shared/ui/Container";
import { Logo } from "@/shared/ui/Logo";
import { useAuthStore } from "@/features/auth/store";
import { useAdminStore } from "@/features/admin/store";
import { getApiBase } from "@/shared/api/client";
import { login as loginApi } from "@/shared/api/auth";

function LoginContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const isAuthed = useAuthStore((s) => s.isAuthed);
  const user = useAuthStore((s) => s.user);
  const setLogin = useAuthStore((s) => s.setLogin);
  const adminLogin = useAdminStore((s) => s.login);

  const next = useMemo(() => sp.get("next") ?? "/", [sp]);
  const expired = sp.get("expired");
  const socialFailed = sp.get("error") === "social_login_failed";

  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expired === "1")
      setErr("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
    else if (socialFailed)
      setErr(
        "소셜 로그인에 실패했습니다. 다시 시도하거나 이메일 로그인을 이용해 주세요.",
      );
  }, [expired, socialFailed]);

  useEffect(() => {
    if (!isAuthed) return;
    router.replace(next);
  }, [isAuthed, router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const isAdminId =
      email === "admin" || email === "admin@admin" || email === "admin@admim";
    if (!isAdminId && !email.includes("@")) {
      setErr("이메일 형식을 확인해 주세요.");
      return;
    }
    if (password.length < 4) {
      setErr("비밀번호를 4자 이상 입력해 주세요.");
      return;
    }

    const apiEmail = isAdminId ? "admin" : email;

    if (!getApiBase()) {
      setErr(
        "서버에 연결할 수 없습니다. API 주소(NEXT_PUBLIC_API_BASE_URL)를 확인해 주세요.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await loginApi({ email: apiEmail, password });
      setLogin({
        accessToken: res.accessToken,
        email: apiEmail,
        name: res.userName,
      });
      if (isAdminId) {
        adminLogin({ email: apiEmail, password });
        router.replace("/admin");
      } else {
        router.replace(next);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setErr(
        msg ?? "로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16"
      style={{ background: "var(--page-bg)", color: "var(--text-primary)" }}
    >
      <Container className="w-full max-w-[520px]">
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card className="mt-10 rounded-3xl border-2 border-[var(--border-subtle)] p-8 shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            Sign In
          </p>
          <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">
            로그인
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            예매/결제는 로그인 후 이용할 수 있어요.
          </p>

          {err ? (
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm font-medium"
              style={{
                borderColor: "var(--accent)",
                background: "var(--accent-muted)",
                color: "var(--accent)",
              }}
            >
              {err}
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                이메일
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-base h-12 rounded-2xl px-4 text-sm"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                비밀번호
              </span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••"
                autoComplete="off"
                className="input-base h-12 rounded-2xl px-4 text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 h-12 rounded-2xl bg-[var(--accent)] text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "로그인 중…" : "로그인"}
            </button>

            {getApiBase() ? (
              <a
                href={`${getApiBase()!.replace(/\/$/, "")}/oauth2/authorization/google`}
                onClick={() => {
                  if (next && next !== "/")
                    sessionStorage.setItem("oauth_next", next);
                }}
                className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                구글로 로그인
              </a>
            ) : null}
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <Link
              href={`/auth/register?next=${encodeURIComponent(next)}`}
              className="hover:underline"
            >
              회원가입
            </Link>
            <Link href="/" className="hover:underline">
              홈으로
            </Link>
          </div>
        </Card>
      </Container>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="text-[var(--text-muted)]">로딩 중…</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
