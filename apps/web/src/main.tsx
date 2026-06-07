import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isExpectedClientError } from "./lib/api";
import { initSentry, reportQueryError } from "./lib/sentry";
import { router } from "./router";
import "./index.css";

// 描画より前に Sentry を初期化する（DSN 未設定なら no-op / ADR-0035）。
initSentry();

const queryClient = new QueryClient({
  // クエリエラーを一元的に Sentry へ報告する（想定外エラーのみ。UI の挙動は変えない）。
  queryCache: new QueryCache({
    onError: (error) => reportQueryError(error),
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) =>
        !isExpectedClientError(error) && failureCount < 3,
    },
  },
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root element not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
