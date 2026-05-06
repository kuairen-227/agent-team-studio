import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
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

export const templateNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/templates/$templateId/new",
  component: TemplateNewPage,
});

// Stub: US-3/US-4 で実装予定
export const executionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/executions/$executionId",
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});

// Stub: US-5 で実装予定
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
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
