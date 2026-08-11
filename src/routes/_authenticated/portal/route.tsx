import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/vantage/theme";

export const Route = createFileRoute("/_authenticated/portal")({
  component: () => (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  ),
});
