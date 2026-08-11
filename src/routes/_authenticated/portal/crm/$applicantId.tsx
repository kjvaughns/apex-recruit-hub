import { createFileRoute, redirect } from "@tanstack/react-router";

// The applicant detail moved to /portal/applicants/$applicantId. Redirect
// param-preserving so old links/bookmarks keep working.
export const Route = createFileRoute("/_authenticated/portal/crm/$applicantId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/portal/applicants/$applicantId",
      params: { applicantId: params.applicantId },
    });
  },
});
