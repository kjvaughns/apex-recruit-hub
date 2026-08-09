import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/application-complete")({
  head: () => ({
    meta: [
      { title: "Application received — Vantage Financial" },
      { name: "description", content: "Your Vantage Financial application has been received." },
      { property: "og:title", content: "Application received" },
      { property: "og:description", content: "Thanks for applying. A team lead will be in touch." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Outlet />,
});

