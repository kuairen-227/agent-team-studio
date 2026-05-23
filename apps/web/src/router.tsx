import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ExecutionProgressPage } from "@/features/executions/ExecutionProgressPage";
import { HistoryListPage } from "@/features/history/HistoryListPage";
import { TemplateListPage } from "@/features/templates/TemplateListPage";
import { TemplateNewPage } from "@/features/templates/TemplateNewPage";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
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
