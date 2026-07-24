import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/apex/brand";
import { getCalendlyUrl, markScheduled } from "@/lib/applications.functions";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule your overview call — APEX Financial" },
      { name: "description", content: "Book a short overview call with an APEX team lead." },
      { property: "og:title", content: "Schedule your APEX overview call" },
      { property: "og:description", content: "Pick a time and we'll walk you through the next steps." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async () => await getCalendlyUrl(),
  component: SchedulePage,
});

function SchedulePage() {
  const { url } = Route.useLoaderData();
  const [firstName, setFirstName] = useState("there");
  const [email, setEmail] = useState("");
  const mark = useServerFn(markScheduled);

  useEffect(() => {
    setFirstName(sessionStorage.getItem("apex_applicant_first") || "there");
    setEmail(sessionStorage.getItem("apex_applicant_email") || "");
  }, []);

  async function onConfirm() {
    if (!email) return;
    try {
      await mark({ data: { email } });
    } catch {
      /* non-blocking */
    }
    window.location.href = "/application-complete";
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] px-6 pt-14 pb-24 text-center md:px-8">
        <div className="apx-eyebrow-pill mb-5 inline-flex">Step 2 of 3</div>
        <h1 className="font-display text-[clamp(36px,6vw,58px)] leading-[0.96]">
          You're in, {firstName} — now book your overview
        </h1>
        <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-relaxed text-apex-muted">
          Pick a time below. {email && (<>We've also emailed this link to <span className="text-apex-fog">{email}</span>.</>)}
        </p>

        <CalendlyInline url={url} />


        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a href={url} target="_blank" rel="noreferrer noopener" className="apx-btn-ghost px-6 py-3.5 text-[15px]">
            Open Calendly in a new tab →
          </a>
          <button onClick={onConfirm} className="apx-btn-primary px-6 py-3.5 text-[15px]">
            I've booked — continue →
          </button>
        </div>
        <div className="mt-4">
          <Link to="/" className="text-[13px] text-apex-faint hover:text-apex-gold">
            Back to home
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

function CalendlyInline({ url }: { url: string }) {
  useEffect(() => {
    const SRC = "https://assets.calendly.com/assets/external/widget.js";
    const w = window as unknown as { Calendly?: { initInlineWidgets?: () => void } };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      w.Calendly?.initInlineWidgets?.();
      return;
    }
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => w.Calendly?.initInlineWidgets?.();
    document.body.appendChild(s);
  }, [url]);

  return (
    <div className="apx-card mt-10 overflow-hidden p-2">
      <div
        className="calendly-inline-widget rounded-[14px]"
        data-url={url}
        style={{ minWidth: 320, height: 720 }}
      />
    </div>
  );
}
