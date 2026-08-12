import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/vantage/brand";
import { DISCORD_INVITE_URL } from "@/lib/next-steps";
import { confirmCoursePurchase } from "@/lib/recruiting.functions";

export const Route = createFileRoute("/course-purchased/$token")({
  head: () => ({
    meta: [
      { title: "Course confirmed — Vantage Financial pre licensing" },
      {
        name: "description",
        content:
          "Your licensing course is confirmed. Here's exactly what happens next on your way to getting licensed with Vantage Financial.",
      },
      { property: "og:title", content: "Course confirmed — you're in pre licensing" },
      {
        property: "og:description",
        content: "Study daily, pass your state exam, and tell your recruiter when you're ready.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => ({
    result: await confirmCoursePurchase({ data: { token: params.token } }),
  }),
  component: CoursePurchased,
});

function CoursePurchased() {
  const { result } = Route.useLoaderData();

  if (!result.ok) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[720px] px-6 pt-24 pb-24 text-center md:px-8">
          <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-none">Link expired</h1>
          <p className="mt-4 text-vantage-muted">
            This confirmation link is no longer valid. Message your recruiter and they'll move you
            forward.
          </p>
          <div className="mt-6">
            <Link to="/" className="vantage-btn-primary px-6 py-3.5">
              Back to Vantage →
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  const name = result.first_name?.trim() || "there";

  return (
    <PublicShell>
      <div className="mx-auto max-w-[760px] px-6 pt-24 pb-24 md:px-8">
        <p className="text-xs tracking-[0.28em] text-vantage-gold uppercase">Pre licensing</p>
        <h1 className="mt-3 font-display text-[clamp(34px,5.5vw,54px)] leading-none">
          You're locked in, {name}
        </h1>
        <p className="mt-4 text-vantage-muted">
          {result.already
            ? "We already have your course confirmed — you're in pre licensing. Here's the plan."
            : "Your licensing course is confirmed and you've moved into pre licensing. Here's the plan."}
        </p>

        <ol className="mt-8 space-y-4">
          {[
            "Work your course daily — an hour or two a day beats a weekend cram.",
            "Run practice exams until you're passing them comfortably.",
            "Tell your recruiter when you're ready and we'll schedule your state exam.",
            "Pass, apply for your license, then send your NPN to your recruiter.",
          ].map((step, i) => (
            <li
              key={step}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <span className="font-display text-2xl text-vantage-gold">{i + 1}</span>
              <span className="text-vantage-ink/90">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noreferrer"
            className="vantage-btn-primary px-6 py-3.5"
          >
            Join the Discord →
          </a>
          <Link to="/" className="vantage-btn-ghost px-6 py-3.5">
            Back to Vantage
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
