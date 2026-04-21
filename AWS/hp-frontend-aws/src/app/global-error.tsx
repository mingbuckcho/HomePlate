"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          background: "#f5f4f0",
          color: "#1a1a1a",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          오류가 발생했습니다
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#4a4a4a" }}>
          잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.5rem",
            background: "#c41e3a",
            color: "#fff",
            border: "none",
            borderRadius: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
