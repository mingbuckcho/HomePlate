"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card } from "@/shared/ui/Card";
import { Container } from "@/shared/ui/Container";
import { Logo } from "@/shared/ui/Logo";
import { getApiBase } from "@/shared/api/client";
import { requestEmailCode, verifyEmailCode, signUp } from "@/shared/api/auth";

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function RegisterContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = useMemo(() => sp.get("next") ?? "/", [sp]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const requestCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email.includes("@")) {
      setErr("이메일 형식을 확인해 주세요.");
      return;
    }
    if (!getApiBase()) {
      setErr("서버에 연결할 수 없습니다. API 주소를 확인해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await requestEmailCode(email);
      setCodeSent(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setErr(
        msg ??
          "인증코드 발송에 실패했습니다. 이메일을 확인하거나 이미 가입된 이메일인지 확인해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErr(null);
    if (!code.trim()) {
      setErr("인증코드를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await verifyEmailCode(email, code.trim());
      setEmailVerified(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setErr(
        msg ??
          "인증에 실패했습니다. 코드를 확인하거나 만료 시 다시 인증코드를 받아 주세요.",
      );
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) return setErr("이름을 입력해 주세요.");
    if (!phone.trim()) return setErr("전화번호를 입력해 주세요.");
    if (!email.includes("@")) return setErr("이메일 형식을 확인해 주세요.");
    if (!emailVerified) return setErr("이메일 인증을 먼저 완료해 주세요.");
    if (pw.length < 4) return setErr("비밀번호를 4자 이상 입력해 주세요.");
    if (pw !== pw2) return setErr("비밀번호 확인이 일치하지 않습니다.");

    if (!getApiBase()) {
      setErr("서버에 연결할 수 없습니다. API 주소를 확인해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await signUp({
        email,
        password: pw,
        userName: name,
        phone: phone.replace(/\D/g, ""),
      });
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setErr(msg ?? "회원가입에 실패했습니다. 다시 시도해 주세요.");
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
            Sign Up
          </p>
          <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">
            회원가입
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
                이름
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-base h-12 rounded-2xl px-4 text-sm"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                전화번호
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="010-0000-0000"
                className="input-base h-12 rounded-2xl px-4 text-sm"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                이메일
              </span>
              <div className="flex gap-2">
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setCodeSent(false);
                    setEmailVerified(false);
                  }}
                  placeholder="you@example.com"
                  className="input-base h-12 flex-1 rounded-2xl px-4 text-sm"
                  readOnly={emailVerified}
                />
                {!emailVerified && getApiBase() && (
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={loading}
                    className="shrink-0 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm font-bold hover:bg-[var(--surface-hover)] disabled:opacity-60"
                  >
                    {loading ? "발송 중…" : "인증코드 받기"}
                  </button>
                )}
              </div>
              {emailVerified ? (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ 이메일 인증 완료
                </p>
              ) : codeSent ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6자리 코드"
                    className="input-base h-10 w-28 rounded-xl px-3 text-sm font-mono tracking-widest"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={loading}
                    className="rounded-xl bg-[var(--accent)] px-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? "확인 중…" : "인증하기"}
                  </button>
                </div>
              ) : null}
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                비밀번호
              </span>
              <input
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="input-base h-12 rounded-2xl px-4 text-sm"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                비밀번호 확인
              </span>
              <input
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                type="password"
                autoComplete="off"
                className="input-base h-12 rounded-2xl px-4 text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !emailVerified}
              className="mt-4 h-12 rounded-2xl bg-[var(--accent)] text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "가입 중…" : "가입하기"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <Link
              href={`/auth/login?next=${encodeURIComponent(next)}`}
              className="hover:underline"
            >
              이미 계정이 있나요?
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

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="text-[var(--text-muted)]">로딩 중…</div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
