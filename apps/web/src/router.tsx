import * as Sentry from "@sentry/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExecutionProgressPage } from "@/features/executions/ExecutionProgressPage";
import { HistoryListPage } from "@/features/history/HistoryListPage";
import { TemplateListPage } from "@/features/templates/TemplateListPage";
import { TemplateNewPage } from "@/features/templates/TemplateNewPage";

/**
 * 描画中の未捕捉エラーのフォールバック UI。`Sentry.ErrorBoundary` がここを表示し、
 * 同時に Sentry へ例外を送信する（uncaught error の捕捉 / ADR-0035）。
 */
function AppErrorFallback() {
  return (
    <Alert variant="destructive">
      <AlertTitle>予期しないエラーが発生しました</AlertTitle>
      <AlertDescription>
        画面の表示中に問題が発生しました。お手数ですがページを再読み込みしてください。
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          再読み込み
        </Button>
      </AlertDescription>
    </Alert>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>
          <Outlet />
        </Sentry.ErrorBoundary>
      </main>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TemplateListPage,
});

const templateNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/templates/$templateId/new",
  component: TemplateNewPage,
});

const executionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/executions/$executionId",
  component: ExecutionProgressPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryListPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  templateNewRoute,
  executionRoute,
  historyRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
