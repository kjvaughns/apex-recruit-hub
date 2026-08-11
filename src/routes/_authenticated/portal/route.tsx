import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/apex/theme";

export const Route = createFileRoute("/_authenticated/portal")({
  component: () => (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  ),
});
