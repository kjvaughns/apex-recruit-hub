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
      { title: "APEX Financial Empire — Build a real career in life insurance" },
      {
        name: "description",
        content:
          "A technology-driven life insurance agency for serious agents: 50% to 145% uncapped commission, daily pay opportunities, unlimited lead access, 20+ carriers, hands-on training, and a real path into leadership. Licensed and unlicensed candidates may apply.",
      },
      { property: "og:title", content: "APEX Financial Empire" },
      {
        property: "og:description",
        content:
          "Uncapped commission, daily pay opportunities, unlimited leads, and a real path into leadership. Now hiring serious agents.",
      },
    ],
  }),
  component: LandingPage,
});

const heroStats = [
  "50% to 145% commission",
  "Daily pay opportunities",
  "Unlimited lead access",
  "20+ carriers",
  "Inbound & outbound opportunities",
];

const highlights = [
  {
    t: "50%–145% uncapped commission",
    d: "Commission that scales with your position, production, and promotions — with no ceiling.",
  },
  {
    t: "Daily pay opportunities",
    d: "Eligible business can pay quickly through fast-pay carriers, based on processing and placement.",
  },
  {
    t: "Unlimited lead access",
    d: "Access to a large internal lead pool and ongoing campaigns across multiple channels.",
  },
  {
    t: "Inbound & outbound opportunities",
    d: "Work outbound lead campaigns and qualify for inbound Policy Service Request opportunities.",
  },
  {
    t: "In-house promotions",
    d: "Advance through the APEX promotion structure by meeting production and leadership standards.",
  },
  {
    t: "20+ carrier options",
    d: "Coverage options for many ages, health conditions, and client needs nationwide.",
  },
  {
    t: "Fast electronic applications",
    d: "Submit eligible applications electronically through streamlined carrier systems.",
  },
  {
    t: "AI-powered CRM & retention",
    d: "Manage applicants, clients, follow-ups, and retention through one connected platform.",
  },
  { t: "One-link contracting", d: "Get contracted through a simple, streamlined onboarding link." },
  {
    t: "Hands-on training",
    d: "Practical training on the skills agents actually need to produce.",
  },
  {
    t: "Build a team from day one",
    d: "Earn the opportunity to recruit, develop, and lead your own team.",
  },
  {
    t: "Long-term residual income",
    d: "Build personal production income, residual opportunities, and team overrides over time.",
  },
];

const whatCards = [
  {
    t: "Production",
    d: "A sales system designed to help agents spend more time speaking with prospects and closing business.",
  },
  {
    t: "Technology",
    d: "Power dialing, AI-powered CRM tools, automated follow-up, retention systems, and fast electronic applications.",
  },
  {
    t: "Leadership",
    d: "In-house promotions, team building opportunities, accountability, skill development, and long-term career growth.",
  },
];

const values = ["Skill", "Speed", "Production", "Leadership", "Accountability"];

const systemCards = [
  {
    t: "Unlimited in-house leads",
    d: "Access ongoing lead campaigns and a large internal lead pool designed to provide consistent opportunity.",
  },
  {
    t: "Inbound & outbound opportunities",
    d: "Work outbound lead campaigns through the APEX dialing system and qualify for inbound Policy Service Request opportunities.",
  },
  {
    t: "Power dialing technology",
    d: "Use Readymode technology to connect with prospects faster instead of manually dialing one number at a time.",
  },
  {
    t: "AI-powered CRM",
    d: "Manage applicants, clients, follow-ups, contracts, commissions, and agency activity through one connected platform.",
  },
  {
    t: "AI retention system",
    d: "Use automated texts, emails, reminders, follow-ups, and retention workflows to protect business after the sale.",
  },
  {
    t: "Fast electronic applications",
    d: "Submit eligible applications electronically through streamlined carrier systems and receive payments per carrier schedules.",
  },
];

const salesChannels = [
  "Exclusive in-house lead system",
  "Outbound power dialing",
  "Inbound Policy Service Request opportunities",
  "Veteran and Final Expense lead campaigns",
  "Follow-up and retention opportunities",
];

const compCards = [
  {
    t: "Uncapped commission",
    d: "Earn between 50% and 145% commission based on your position, production, experience, and promotion level.",
  },
  {
    t: "Daily pay opportunities",
    d: "Eligible business may pay quickly based on carrier processing, policy placement, and commission status.",
  },
  {
    t: "In-house promotions",
    d: "Advance through the APEX promotion structure by meeting production, leadership, and performance standards.",
  },
  {
    t: "Long-term income",
    d: "Build personal production income, residual opportunities, team overrides, and leadership income over time.",
  },
];

const trainingTopics = [
  "Lead management",
  "Outbound dialing",
  "Inbound sales opportunities",
  "Appointment setting",
  "Needs analysis",
  "Product positioning",
  "Objection handling",
  "Electronic applications",
  "Follow-up",
  "Policy placement",
  "Retention",
  "Team building",
  "Leadership",
];

const careerStages = [
  {
    n: "1",
    title: "New agent",
    desc: "Learn the system, complete training, and develop consistent activity.",
  },
  {
    n: "2",
    title: "Producing agent",
    desc: "Build personal production and improve sales skill, placement, and consistency.",
  },
  {
    n: "3",
    title: "Top producer",
    desc: "Operate at a high level of personal production and help set the standard for the team.",
  },
  {
    n: "4",
    title: "Team builder",
    desc: "Recruit, train, support, and earn overrides from a productive team.",
  },
  {
    n: "5",
    title: "Agency leader",
    desc: "Build leaders, develop multiple teams, and create long-term agency growth.",
  },
];

const goodFit = [
  "You want to build a serious life insurance career",
  "You are coachable and willing to follow a system",
  "You are competitive and self-motivated",
  "You take personal responsibility",
  "You want long-term production and leadership growth",
  "You are willing to speak with prospects consistently",
  "You can operate in a performance-driven environment",
];

const notFit = [
  "You want guaranteed income without consistent activity",
  "You need to be chased to complete basic responsibilities",
  "You are unwilling to make outbound calls",
  "You are uncomfortable with accountability",
  "You only want to casually test the industry",
  "You are unwilling to complete licensing or training requirements",
];

const unlicensedSteps = [
  "Complete the application",
  "Attend the company overview",
  "Complete the evaluation",
  "Begin the approved licensing course",
  "Pass the state exam",
  "Apply for the state license",
  "Complete APEX onboarding",
];

const licensedSteps = [
  "Complete the application",
  "Schedule a licensed agent interview",
  "Complete the evaluation",
  "Submit contracting information",
  "Complete the APEX closer training",
  "Begin team training",
  "Get released to production",
];

const testimonials = [
  {
    quote: "I replaced my salary in 90 days and now run a team of nine agents.",
    name: "Marcus T.",
    role: "Agency Director",
    initials: "MT",
  },
  {
    quote:
      "The lead system changed everything. I'm not chasing anyone — I'm talking to people every day.",
    name: "Dana R.",
    role: "Senior Agent",
    initials: "DR",
  },
  {
    quote: "I came in with zero experience. APEX licensed and trained me start to finish.",
    name: "Luis M.",
    role: "Field Agent",
    initials: "LM",
  },
];

const faqs = [
  {
    q: "Is this position inbound or outbound?",
    a: "APEX offers both. Agents can work outbound lead campaigns through our power dialing system and may also qualify for inbound Policy Service Request opportunities.",
  },
  {
    q: "Are leads provided?",
    a: "Agents receive access to APEX lead systems, including ongoing in-house campaigns, a large lead pool, and multiple lead channels. Lead access, eligibility, and specific programs may depend on the agent's position and current company guidelines.",
  },
  {
    q: "How does commission work?",
    a: "Commission levels range from 50% to 145% based on experience, position, production, promotions, and company requirements. Compensation is uncapped, but income is not guaranteed.",
  },
  {
    q: "How often are agents paid?",
    a: "APEX offers daily pay opportunities through eligible carriers and policies. Actual payment timing depends on carrier processing, policy placement, banking, and commission status.",
  },
  {
    q: "Do I need a license?",
    a: "No. Licensed and unlicensed candidates may apply. Unlicensed candidates must complete their state licensing requirements before selling insurance.",
  },
  {
    q: "Can I build a team?",
    a: "Yes. Agents may earn the opportunity to recruit, develop, and lead a team through the APEX in-house promotion structure.",
  },
  {
    q: "Is this remote?",
    a: "The sales system is designed to support virtual life insurance sales. Specific training, licensing, technology, and activity requirements still apply.",
  },
  {
    q: "Is income guaranteed?",
    a: "No. This is a performance-based sales opportunity. Income depends on licensing, activity, skill, placement, carrier approvals, chargebacks, and consistency.",
  },
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
              Now Hiring Serious Agents
            </div>
            <h1 className="max-w-[16ch] font-display text-[clamp(48px,8vw,100px)] leading-[0.9] text-apex-ivory text-balance">
              Build a real career in <span className="apx-gold-text">life insurance</span>
            </h1>

            {/* VSL slot */}
            <div className="mt-8 w-full max-w-[760px]">
              <div className="mb-4 apx-kicker text-center">
                <span className="apx-glow-dot mr-2 inline-block h-1.5 w-1.5 rounded-full bg-apex-gold align-middle" />
                Watch This First
              </div>
              <div
                className="relative aspect-video w-full overflow-hidden rounded-[22px] border border-apex-gold/30"
                style={{
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.08) inset, 0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(201,168,76,0.1)",
                }}
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

            <p className="mt-8 max-w-[560px] text-[17px] leading-relaxed text-apex-muted">
              Join a technology-driven life insurance agency built for serious agents who want daily
              pay opportunities, unlimited leads, uncapped commission, hands-on training, and a real
              path into leadership.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3.5">
              <Link
                to="/apply"
                search={applySearch}
                className="apx-btn-primary px-7 py-4 text-[16px]"
              >
                Start Your Application <span>→</span>
              </Link>
              <a href="#about" className="apx-btn-ghost px-7 py-4 text-[16px]">
                See How It Works
              </a>
            </div>
            <p className="mt-4 text-[13.5px] text-apex-faint">
              Licensed and unlicensed candidates may apply.
            </p>

            {/* Credibility row */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 text-[12.5px] text-apex-muted">
              {heroStats.map((c, i) => (
                <span key={c} className="flex items-center gap-2.5">
                  {i > 0 && <span className="text-apex-gold/40">•</span>}
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* OPPORTUNITY HIGHLIGHTS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="The Opportunity" title="An offer built for people who want to win" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {highlights.map((o) => (
            <div
              key={o.t}
              className="apx-card flex flex-col gap-2.5 p-6 transition hover:-translate-y-1 hover:border-apex-gold/50"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-apex-gold">✦</span>
                <div className="font-display text-[22px] leading-tight text-apex-ivory">{o.t}</div>
              </div>
              <div className="text-[14px] leading-relaxed text-apex-dim">{o.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* WHAT IS APEX */}
      <div id="about" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead
          kicker="Who We Are"
          title="What is APEX Financial?"
          body="APEX Financial Empire is a life insurance agency and brokerage built for high-level production. We partner with more than 20 carriers nationwide, giving agents access to coverage options for many different ages, health conditions, and client needs. Our agents receive access to modern sales technology, electronic applications, lead systems, hands-on training, contracting support, and a clear path from personal production into leadership."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {whatCards.map((c) => (
            <div key={c.t} className="apx-card flex flex-col gap-3 p-7">
              <div className="font-display text-[26px] leading-none text-apex-gold">{c.t}</div>
              <div className="text-[14.5px] leading-relaxed text-apex-dim">{c.d}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-apex-faint">
            Built on
          </span>
          {values.map((v) => (
            <span key={v} className="apx-eyebrow-pill text-[12px]">
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* APEX SALES SYSTEM */}
      <div id="system" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead
          kicker="How It Works"
          title="The APEX sales system"
          body="APEX gives agents access to both inbound and outbound sales opportunities — built to give serious agents consistent access to people who have expressed interest or requested insurance-related assistance."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {systemCards.map((c) => (
            <div
              key={c.t}
              className="apx-card flex min-h-[190px] flex-col gap-3 p-7 transition hover:-translate-y-1 hover:border-apex-gold/50"
            >
              <div className="font-display text-[24px] leading-tight text-apex-ivory">{c.t}</div>
              <div className="text-[14px] leading-relaxed text-apex-dim">{c.d}</div>
            </div>
          ))}
        </div>

        {/* Multiple ways to win + unlimited opportunity */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="apx-card flex flex-col gap-4 p-8">
            <div className="apx-kicker">Multiple Ways to Win</div>
            <div className="font-display text-[28px] leading-none">
              More than one way to reach people
            </div>
            <div className="flex flex-col gap-2.5">
              {salesChannels.map((c) => (
                <div key={c} className="flex items-center gap-3 text-[15px] text-apex-fog">
                  <span className="text-apex-gold">✦</span>
                  {c}
                </div>
              ))}
            </div>
          </div>
          <div className="apx-card apx-card-gold flex flex-col justify-center gap-3 p-8">
            <div className="apx-kicker">Unlimited Opportunity</div>
            <div className="font-display text-[28px] leading-none text-apex-gold">
              Not a small weekly batch of prospects
            </div>
            <p className="text-[15px] leading-relaxed text-apex-fog">
              APEX provides access to a large internal lead pool, ongoing campaigns, and multiple
              lead channels so committed agents can maintain consistent activity — access to
              unlimited lead opportunities through the APEX sales system.
            </p>
            <p className="text-[12.5px] text-apex-muted">
              Unlimited leads does not mean guaranteed sales or guaranteed income.
            </p>
          </div>
        </div>
      </div>

      {/* COMPENSATION & PROMOTIONS */}
      <div id="compensation" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead
          kicker="Uncapped Earning Potential"
          title="Your production. Your promotion. Your income."
          body="Start between 50% and 145% commission based on experience, production, and position. Earn promotions inside the agency, get access to daily pay opportunities, and build long-term income through personal production, residuals, and team overrides."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {compCards.map((c) => (
            <div
              key={c.t}
              className="apx-card flex flex-col gap-3 p-7 transition hover:-translate-y-1"
            >
              <div className="font-display text-[24px] leading-tight text-apex-gold">{c.t}</div>
              <div className="text-[14px] leading-relaxed text-apex-dim">{c.d}</div>
            </div>
          ))}
        </div>
        <div className="apx-card apx-card-gold mt-4 p-8 text-center md:p-10">
          <p className="font-display text-[clamp(26px,3.4vw,40px)] leading-tight text-apex-ivory">
            APEX is designed to help agents become{" "}
            <span className="apx-gold-text">producers first</span> and{" "}
            <span className="apx-gold-text">leaders second</span>.
          </p>
        </div>
        <p className="mt-5 max-w-[860px] text-[12.5px] leading-relaxed text-apex-faint">
          Commission levels and promotions depend on production, experience, performance, carrier
          requirements, leadership progress, and company guidelines. Income is not guaranteed.
          Results vary based on licensing, effort, sales activity, skill, placement, chargebacks,
          carrier approvals, and consistency.
        </p>
      </div>

      {/* TRAINING & TECHNOLOGY */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead
          kicker="Training"
          title="Built to develop serious agents"
          body="APEX provides hands-on training focused on the skills agents actually need to produce. The systems and training are provided — but agents must take action and remain coachable."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {trainingTopics.map((t) => (
            <div
              key={t}
              className="flex items-center gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-4 text-[15px] text-apex-fog"
            >
              <span className="text-apex-gold">✦</span>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* CAREER PATH */}
      <div id="path" className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead
          kicker="The Path"
          title="The APEX career path"
          body="Promotions are earned through production, leadership, accountability, and consistency."
        />
        <div className="grid gap-6 md:grid-cols-3 xl:grid-cols-5">
          {careerStages.map((s) => (
            <div key={s.n} className="flex flex-col gap-3.5">
              <div className="flex items-center gap-3.5">
                <div
                  className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full border-[1.5px] border-apex-gold/50 font-display text-[22px] text-apex-gold"
                  style={{
                    background:
                      "linear-gradient(160deg,rgba(201,168,76,0.18),rgba(201,168,76,0.04))",
                    boxShadow: "0 0 24px rgba(201,168,76,0.12)",
                  }}
                >
                  {s.n}
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-apex-gold/40 to-white/[0.04]" />
              </div>
              <div className="font-display text-[24px] leading-none">{s.title}</div>
              <div className="text-[14px] leading-relaxed text-apex-dim">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* WHO APEX IS FOR */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead
          kicker="Selective by Design"
          title="Are you a good fit for APEX?"
          body="We are not looking for everyone. We are looking for people who are serious, coachable, and ready to take action."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="apx-card flex flex-col gap-4 p-8">
            <div className="font-display text-[26px] leading-none text-apex-gold">A strong fit</div>
            <div className="flex flex-col gap-2.5">
              {goodFit.map((g) => (
                <div key={g} className="flex items-start gap-3 text-[15px] text-apex-fog">
                  <span className="mt-0.5 text-apex-gold">✦</span>
                  {g}
                </div>
              ))}
            </div>
          </div>
          <div className="apx-card flex flex-col gap-4 p-8">
            <div className="font-display text-[26px] leading-none text-apex-muted">
              Not the right fit
            </div>
            <div className="flex flex-col gap-2.5">
              {notFit.map((g) => (
                <div key={g} className="flex items-start gap-3 text-[15px] text-apex-dim">
                  <span className="mt-0.5 text-apex-faint">✕</span>
                  {g}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LICENSED & UNLICENSED PATHS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="Two Ways In" title="Licensed or unlicensed, there is a path forward" />
        <div className="grid gap-4 md:grid-cols-2">
          <PathCard title="Unlicensed candidates" steps={unlicensedSteps} />
          <PathCard title="Licensed candidates" steps={licensedSteps} gold />
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div className="mx-auto max-w-[1240px] px-6 pt-24 md:px-8">
        <SectionHead kicker="Agent Voices" title="People who bet on themselves" />
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
        <p className="mt-5 max-w-[860px] text-[12.5px] leading-relaxed text-apex-faint">
          Testimonials represent individual experiences. Results are not typical or guaranteed and
          depend on effort, skill, activity, licensing, placement, and consistency.
        </p>
      </div>

      {/* FAQ */}
      <div id="faq" className="mx-auto max-w-[900px] px-6 pt-24 md:px-8">
        <SectionHead kicker="FAQ" title="The straight answers" />
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <div
              key={f.q}
              className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.02]"
            >
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
              Complete the short application and tell us why you believe you would be a strong fit
              for APEX. Licensed and unlicensed candidates are welcome to apply.
            </p>
            <div className="mt-7 flex flex-col gap-3.5">
              {[
                "Takes about 3 minutes",
                "Licensed and unlicensed candidates welcome",
                "A real person follows up within one business day",
              ].map((p) => (
                <div key={p} className="flex items-center gap-3 text-[15px]">
                  <span className="text-apex-gold">✦</span>
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Link
              to="/apply"
              search={applySearch}
              className="apx-btn-primary w-full px-8 py-5 text-[17px]"
            >
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

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div className="mb-10 max-w-[720px]">
      <div className="mb-3 apx-kicker">{kicker}</div>
      <h2 className="font-display text-[clamp(34px,5vw,58px)] leading-none">{title}</h2>
      {body && <p className="mt-4 text-[16px] leading-relaxed text-apex-muted">{body}</p>}
    </div>
  );
}

function PathCard({ title, steps, gold }: { title: string; steps: string[]; gold?: boolean }) {
  return (
    <div className={`${gold ? "apx-card apx-card-gold" : "apx-card"} flex flex-col gap-4 p-8`}>
      <div
        className={`font-display text-[26px] leading-none ${gold ? "text-apex-gold" : "text-apex-ivory"}`}
      >
        {title}
      </div>
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <div key={s} className="flex items-start gap-3.5 text-[15px] text-apex-fog">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-apex-gold/40 text-[12px] font-semibold text-apex-gold">
              {i + 1}
            </span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
