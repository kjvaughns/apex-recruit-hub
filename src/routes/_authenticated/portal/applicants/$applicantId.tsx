import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/vantage/portal-shell";
import { PageBody } from "@/components/portal/ui";
import { ApplicantRecord } from "@/components/vantage/applicant-record";

export const Route = createFileRoute("/_authenticated/portal/applicants/$applicantId")({
  head: () => ({
    meta: [{ title: "Applicant — Vantage Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: ApplicantDetailPage,
});

function ApplicantDetailPage() {
  const { applicantId } = Route.useParams();
  return (
    <PortalShell>
      <PageBody>
        <ApplicantRecord applicantId={applicantId} variant="page" />
      </PageBody>
    </PortalShell>
  );
}
