import { createFileRoute, redirect } from "@tanstack/react-router";

// CRM was merged into the Applicants page (List tab). Redirect to preserve
// existing links/bookmarks.
export const Route = createFileRoute("/_authenticated/portal/crm/")({
  beforeLoad: () => {
    throw redirect({ to: "/portal/applicants" });
  },
});
