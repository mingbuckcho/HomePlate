import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--accent)]">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          요청하신 주소가 잘못되었거나 페이지가 이동했을 수 있습니다.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:opacity-90"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
