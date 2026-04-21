"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ThemeSync } from "@/features/theme/ThemeSync";
import { useAuthStore } from "@/features/auth/store";
import { setAccessTokenGetter } from "@/shared/api/client";
import RumProvider from "./rum-provider";

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(() => new QueryClient());

  useEffect(() => {
    setAccessTokenGetter(() => useAuthStore.getState().accessToken ?? null);
  }, []);

  return (
    <RumProvider>
      <ThemeSync />
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </RumProvider>
  );
}
