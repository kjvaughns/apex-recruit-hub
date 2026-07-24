import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PublicShell } from "@/components/apex/brand";
import { getRecruiterBySlug } from "@/lib/applications.functions";
import { saveReferral } from "@/lib/referral";

const searchSchema = z.object({ ref: z.string().optional() });

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "APEX Financial Empire — Build your empire in insurance sales" },
      {
        name: "description",
        content:
          "Uncapped commissions paid weekly, warm inbound leads, and free licensing and training. No experience needed — we build producers from the ground up.",
      },
      { property: "og:title", content: "APEX Financial Empire" },
      {
        property: "og:description",
        content: "Uncapped weekly commissions, warm leads, and free training. Now hiring driven agents.",
      },
    ],
  }),
  component: LandingPage,
});

const TOP_RATE = 145;

const offers = [
  { num: `${TOP_RATE}%`, label: "Uncapped comp", desc: `Commission rates that scale to ${TOP_RATE}% — among the highest in the industry, with no ceiling.` },
  { num: "7 days", label: "Weekly pay", desc: "Get paid every week. No 30-day waits — your commissions hit your account fast." },
  { num: "Warm", label: "Real leads", desc: "Stop dialing strangers. We route qualified, inbound prospects who already asked for an agent." },
  { num: "$0", label: "Free training", desc: "Licensing support, proven scripts, and live mentorship from top producers — at no cost." },
];

const steps = [
  { n: "1", title: "Apply", desc: "Tell us about yourself in three minutes. No résumé and no prior experience required." },
  { n: "2", title: "Get licensed", desc: "We guide you through your state licensing and cover the study resources to get there fast." },
  { n: "3", title: "Train & shadow", desc: "Learn the playbook, shadow top producers, and run your first real appointments with support." },
  { n: "4", title: "Build your book", desc: "Write business, earn weekly, then recruit and lead your own team to multiply your income." },
];

const tiers = [
  { tier: "Part-time", amount: "$2K–5K", desc: "A few appointments a week alongside your current job. A real second income.", gold: false },
  { tier: "Full-time", amount: "$8K–15K", desc: "Committed producers running daily appointments off a steady flow of warm leads.", gold: true },
  { tier: "Agency builder", amount: "$25K+", desc: "Top agents who recruit, train, and earn overrides on a growing team beneath them.", gold: false },
];

const perks = [
  "Mentorship from six- and seven-figure producers",
  "A proven, duplicatable sales system",
  "A vested, ownable book of business",
  "Bonuses, incentive trips & equity upside",
  "Flexible schedule — remote-friendly",
  "A clear path to build your own agency",
];

const testimonials = [
  { quote: "I replaced my salary in 90 days and now run a team of nine agents.", name: "Marcus T.", role: "Agency Director", initials: "MT" },
  { quote: "The warm leads changed everything. I'm not chasing anyone — I'm closing.", name: "Dana R.", role: "Senior Agent", initials: "DR" },
  { quote: "I came in with zero experience. APEX licensed and trained me start to finish.", name: "Luis M.", role: "Field Agent", initials: "LM" },
];

const faqs = [
  { q: "Do I need a license to start?", a: "No. Most of our agents start unlicensed. We walk you through the process step by step and cover your study materials so you're earning quickly." },
  { q: "Is this commission-only?", a: "Yes — and that's the upside. There's no income ceiling, and you're paid weekly on exactly what you produce." },
  { q: "Do I really get leads?", a: "Yes. We invest in qualified, inbound prospects so you spend your time selling and serving clients, not prospecting." },
  { q: "Can I do this part-time?", a: "Absolutely. Many agents start part-time around another job and scale up to full-time as their income grows." },
  { q: "What does it cost to join?", a: "Training and mentorship are free. You only cover your state licensing fees, which we help you minimize." },
];

function LandingPage() {
  const { ref } = Route.useSearch();
  const resolveRecruiter = useServerFn(getRecruiterBySlug);
  const [openFaq, setOpenFaq] = useState(0);

  // Capture referral attribution for this recruiting session. The visitor stays
  // on the normal landing page; the recruiter is preselected later on /apply.
  useEffect(() => {
    if (!ref) return;
    const landing_url = typeof window !== "undefined" ? window.location.href : "";
    resolveRecruiter({ data: { slug: ref } })
      .then((recruiter) => {
        saveReferral({ slug: ref, recruiter, landing_url, invalid: !recruiter });
      })
      .catch(() => {
        saveReferral({ slug: ref, recruiter: null, landing_url, invalid: true });
      });
  }, [ref, resolveRecruiter]);

  // Carry the ref through to the application so it works even without storage.
  const applySearch = ref ? { ref } : undefined;

  return (
    <PublicShell>
      {/* HERO */}
      <div id="top" className="relative overflow-hidden">
        <div className="mx-auto max-w-[920px] px-6 pt-[60px] pb-14 text-center md:px-8">
          <div className="apx-reveal flex flex-col items-center">
            <div className="apx-eyebrow-pill mb-5">
              <span className="apx-glow-dot h-1.5 w-1.5 rounded-full bg-apex-gold shadow-[0_0_10px_rgba(201,168,76,0.8)]" />
              Now Hiring Driven Agents
            </div>
            <h1 className="max-w-[20ch] font-display text-[clamp(52px,8vw,104px)] leading-[0.9] text-apex-ivory text-balance">
              Build your <span className="apx-gold-text">empire</span> in insurance sales
            </h1>

            {/* VSL slot */}
            <div className="mt-8 w-full max-w-[760px]">
              <div className="mb-4 apx-kicker text-center">
                <span className="apx-glow-dot mr-2 inline-block h-1.5 w-1.5 rounded-full bg-apex-gold align-middle" />
                Watch This First
              </div>
              <div
                className="relative aspect-video w-full overflow-hidden rounded-[22px] border border-apex-gold/30"
                style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset, 0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(201,168,76,0.1)" }}
              >
                <iframe
                  src="https://www.youtube.com/embed/E2VJ1v85IRE"
                  title="APEX Financial — Watch This First"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>

            <p className="mt-8 max-w-[540px] text-[17px] leading-relaxed text-apex-muted">
              Uncapped commissions paid weekly, warm inbound leads, and free licensing &amp; training. No experience needed — we build producers from the ground up.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3.5">
              <Link to="/apply" search={applySearch} className="apx-btn-primary px-7 py-4 text-[16px]">
                Start Your Application <span>→</span>
              </Link>
              <a href="#how" className="apx-btn-ghost px-7 py-4 text-[16px]">
                See How It Works
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* OFFER */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 apx-kicker">Why APEX</div>
          <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-none">An offer built for people who want to win</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {offers.map((o) => (
            <div key={o.label} className="apx-card flex min-h-[230px] flex-col gap-4 p-7 transition hover:-translate-y-1 hover:border-apex-gold/50">
              <div
                className="font-display text-[50px] leading-none"
                style={{ color: "transparent", WebkitTextStroke: "1.5px rgba(201,168,76,0.65)" }}
              >
                {o.num}
              </div>
              <div className="font-display text-[28px] leading-none">{o.label}</div>
              <div className="text-[14.5px] leading-relaxed text-apex-dim">{o.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW */}
      <div id="how" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="mb-12 max-w-[640px]">
          <div className="mb-3 apx-kicker">The Path</div>
          <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-none">From application to your first check</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col gap-3.5">
              <div className="flex items-center gap-3.5">
                <div
                  className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full border-[1.5px] border-apex-gold/50 font-display text-[22px] text-apex-gold"
                  style={{ background: "linear-gradient(160deg,rgba(201,168,76,0.18),rgba(201,168,76,0.04))", boxShadow: "0 0 24px rgba(201,168,76,0.12)" }}
                >
                  {s.n}
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-apex-gold/40 to-white/[0.04]" />
              </div>
              <div className="font-display text-[26px] leading-none">{s.title}</div>
              <div className="text-[14.5px] leading-relaxed text-apex-dim">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* EARNINGS */}
      <div id="earnings" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="mb-12 max-w-[640px]">
          <div className="mb-3 apx-kicker">Earnings Potential</div>
          <h2 className="mb-3 font-display text-[clamp(34px,5vw,58px)] leading-none">You set the ceiling</h2>
          <p className="text-[16px] leading-relaxed text-apex-muted">
            Real ranges from agents on our team. What you earn is a function of effort, not tenure.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.tier}
              className={`${t.gold ? "apx-card apx-card-gold" : "apx-card"} flex flex-col gap-2 p-8 transition hover:-translate-y-1`}
            >
              <div className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${t.gold ? "text-apex-gold" : "text-apex-dim"}`}>
                {t.tier}
              </div>
              <div className={`font-display text-[clamp(40px,5vw,58px)] leading-none ${t.gold ? "text-apex-gold" : "text-apex-ivory"}`}>
                {t.amount}
              </div>
              <div className={`-mt-1 text-[13px] ${t.gold ? "text-apex-muted" : "text-apex-faint"}`}>per month</div>
              <div className={`mt-4 text-[14.5px] leading-relaxed ${t.gold ? "text-apex-fog" : "text-apex-dim"}`}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BENEFITS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 apx-kicker">Benefits</div>
          <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-none">More than a commission</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {perks.map((p) => (
            <div key={p} className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-5 text-[15px] text-apex-fog">
              <span className="text-apex-gold">✦</span>
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 apx-kicker">Agent Voices</div>
          <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-none">People who bet on themselves</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="apx-card flex flex-col gap-6 p-7">
              <p className="text-[16px] leading-relaxed text-apex-fog">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-apex-gold/15 font-display text-apex-gold">
                  {t.initials}
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-apex-ivory">{t.name}</div>
                  <div className="text-[12px] text-apex-faint">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="mx-auto max-w-[900px] px-6 pt-24 md:px-8">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 apx-kicker">FAQ</div>
          <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-none">The straight answers</h2>
        </div>
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <div key={f.q} className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.02]">
              <button
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left text-apex-ivory"
              >
                <span className="text-[16.5px] font-semibold leading-snug">{f.q}</span>
                <span
                  className="flex-none text-[20px] text-apex-gold transition-transform"
                  style={{ transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}
                >
                  +
                </span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 text-[15px] leading-relaxed text-apex-dim">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* APPLY CTA */}
      <div id="apply" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <div className="apx-card apx-card-gold grid gap-8 p-10 md:grid-cols-2 md:p-14">
          <div>
            <h2 className="font-display text-[clamp(40px,5vw,70px)] leading-[0.94]">
              Your empire starts with one application
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-apex-muted">
              Three minutes. No résumé, no obligation. A team lead will reach out to walk you through next steps.
            </p>
            <div className="mt-7 flex flex-col gap-3.5">
              {["Takes about 3 minutes", "No experience necessary", "A real person follows up within one business day"].map((p) => (
                <div key={p} className="flex items-center gap-3 text-[15px]">
                  <span className="text-apex-gold">✦</span>
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Link to="/apply" search={applySearch} className="apx-btn-primary w-full px-8 py-5 text-[17px]">
              Start Your Application <span>→</span>
            </Link>
            <p className="text-[13px] text-apex-faint">
              No résumé required — just a few quick details.
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
