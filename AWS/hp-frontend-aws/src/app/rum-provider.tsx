"use client";

import { useEffect } from "react";
import { initRumMetrics } from "@/lib/rum/metrics";
import { initRum } from "@/lib/rum/client";
import { RumRouteTracker } from "@/lib/rum/route";

export default function RumProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      initRumMetrics(); // OTLP 메트릭 (endpoint 설정 시) — 기존 Faro보다 먼저
      initRum();
    });
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      <RumRouteTracker />
      {children}
    </>
  );
}
