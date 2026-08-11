import { createFileRoute, redirect } from "@tanstack/react-router";

// Pipeline was merged into the Applicants page (Pipeline tab). Redirect to
// preserve existing links/bookmarks.
export const Route = createFileRoute("/_authenticated/portal/pipeline")({
  beforeLoad: () => {
    throw redirect({ to: "/portal/applicants", search: { tab: "pipeline" } });
  },
});
