import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/vantage/brand";

export const Route = createFileRoute("/application-complete/")({
  component: CompletePage,
});

function CompletePage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-[720px] px-6 pt-16 pb-24 text-center md:px-8">
        <div className="vantage-card vantage-card-gold p-10 md:p-14">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-vantage-gold text-[30px] text-vantage-card shadow-[0_0_40px_rgba(201,168,76,0.5)]">
            ✓
          </div>
          <h1 className="font-display text-[clamp(40px,6vw,64px)] leading-[0.96]">Application received</h1>
          <p className="mx-auto mt-5 max-w-[500px] text-[16px] leading-relaxed text-vantage-muted">
            You're locked in. Watch your inbox for a confirmation email and calendar invite. A team lead will follow up within one business day.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/evaluation" className="vantage-btn-ghost px-6 py-3.5 text-[15px]">
              Have an evaluation link?
            </Link>
            <Link to="/" className="vantage-btn-primary px-6 py-3.5 text-[15px]">
              Back to Vantage →
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
