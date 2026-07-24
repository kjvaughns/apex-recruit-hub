import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { PublicShell } from "@/components/apex/brand";
import { StateCombobox } from "@/components/apex/state-combobox";
import { RecruiterCombobox, type RecruiterSelection } from "@/components/apex/recruiter-combobox";
import {
  submitApplication,
  getRecruiterBySlug,
} from "@/lib/applications.functions";
import { getReferral } from "@/lib/referral";

const searchSchema = z.object({
  ref: z.string().optional(),
});

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply — APEX Financial Empire" },
      {
        name: "description",
        content: "Apply to join the APEX Financial recruiting team. Three minutes, no résumé.",
      },
      { property: "og:title", content: "Apply to APEX Financial" },
      {
        property: "og:description",
        content: "Three minutes. No résumé. A team lead follows up within one business day.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: ApplyPage,
});

type Form = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state: string;
  licensed: boolean | null;
  instagram_handle: string;
  why_text: string;
  consent_contact: boolean;
};

const initial: Form = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  state: "",
  licensed: null,
  instagram_handle: "",
  why_text: "",
  consent_contact: false,
};

function ApplyPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const submit = useServerFn(submitApplication);
  const resolveRecruiter = useServerFn(getRecruiterBySlug);

  const [form, setForm] = useState<Form>(initial);
  // Final selected recruiter (what gets submitted) + the original referral-link
  // recruiter (kept for attribution audit even if the applicant changes it).
  const [recruiter, setRecruiter] = useState<RecruiterSelection | null>(null);
  const [originalReferral, setOriginalReferral] = useState<RecruiterSelection | null>(null);
  const [referralSlug, setReferralSlug] = useState("");
  const [invalidSlug, setInvalidSlug] = useState("");
  const [landingUrl, setLandingUrl] = useState("");

  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Preselect the referring recruiter from the current recruiting session
  // (referral link captured on the landing page), falling back to a ?ref= slug
  // on this page directly. Invalid/inactive slugs are recorded but never block.
  useEffect(() => {
    const stored = getReferral();
    if (stored) {
      setReferralSlug(stored.slug);
      setLandingUrl(stored.landing_url);
      if (stored.recruiter) {
        setRecruiter(stored.recruiter);
        setOriginalReferral(stored.recruiter);
      } else {
        setInvalidSlug(stored.slug);
      }
      return;
    }
    if (ref) {
      setReferralSlug(ref);
      resolveRecruiter({ data: { slug: ref } })
        .then((r) => {
          if (r) {
            setRecruiter(r);
            setOriginalReferral(r);
          } else {
            setInvalidSlug(ref);
          }
        })
        .catch(() => setInvalidSlug(ref));
    }
  }, [ref, resolveRecruiter]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit() {
    const errs: string[] = [];
    if (!form.first_name.trim()) errs.push("first name");
    if (!form.last_name.trim()) errs.push("last name");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.push("a valid email");
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 7) errs.push("phone");
    if (!form.state) errs.push("your state");
    if (form.licensed === null) errs.push("your licensing status");
    if (!recruiter) errs.push("who referred you");
    if (!form.why_text.trim() || form.why_text.trim().length < 10)
      errs.push("a short reason (min 10 chars)");
    if (!form.consent_contact) errs.push("consent to be contacted");
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setSubmitting(true);

    const referral_source: "referral_link" | "manual" =
      originalReferral && recruiter && !recruiter.custom && originalReferral.id === recruiter.id
        ? "referral_link"
        : "manual";

    try {
      const res = await submit({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          state: form.state,
          licensed: form.licensed === true,
          instagram_handle: form.instagram_handle.trim(),
          why_text: form.why_text.trim(),
          consent_contact: true,
          referred_by_profile_id: recruiter && !recruiter.custom ? recruiter.id : "",
          referred_by_name: recruiter?.custom ? (recruiter.full_name ?? "") : "",
          original_referral_profile_id: originalReferral?.id ?? "",
          referral_slug: referralSlug,
          referral_source,
          referral_landing_url: landingUrl,
          invalid_referral_slug: invalidSlug,
        },
      });
      sessionStorage.setItem("apex_applicant_first", form.first_name.trim());
      // Route by the applicant's own answer (source of truth on the client),
      // falling back to the server's echo. Prevents any drift between the two.
      const isLicensed =
        form.licensed === true || res.success_page_type === "licensed";
      if (isLicensed) {
        navigate({ to: "/application-complete/licensed/$token", params: { token: res.token } });
      } else {
        navigate({ to: "/application-complete/unlicensed/$token", params: { token: res.token } });
      }
    } catch (e) {
      setErrors([(e as Error).message || "Something went wrong. Try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[900px] px-6 pt-14 pb-24 md:px-8">
        <div className="apx-reveal text-center">
          <div className="apx-eyebrow-pill mb-5 inline-flex">Join the team</div>
          <h1 className="font-display text-[clamp(40px,6vw,68px)] leading-none">
            Your APEX application
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-relaxed text-apex-muted">
            Three minutes. After you apply, you'll book a short overview call and we'll email you
            the details.
          </p>
          {recruiter && (
            <p className="mt-5 text-[14px] text-apex-gold">
              Referred by{" "}
              <span className="font-semibold text-apex-ivory">{recruiter.full_name}</span>
            </p>
          )}
        </div>

        <div className="apx-card mt-12 grid gap-4 p-6 md:p-10">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name *">
              <input
                className="apx-input"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Last name *">
              <input
                className="apx-input"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Email *">
            <input
              type="email"
              className="apx-input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Phone *">
            <input
              type="tel"
              className="apx-input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="State *">
            <StateCombobox value={form.state} onChange={(v) => set("state", v)} />
          </Field>
          <Field label="Are you currently licensed? *">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => set("licensed", true)}
                className={cn(
                  "apx-input flex items-center justify-center font-medium transition-colors",
                  form.licensed === true ? "border-apex-gold text-apex-ivory" : "text-apex-muted",
                )}
              >
                Yes, I'm licensed
              </button>
              <button
                type="button"
                onClick={() => set("licensed", false)}
                className={cn(
                  "apx-input flex items-center justify-center font-medium transition-colors",
                  form.licensed === false ? "border-apex-gold text-apex-ivory" : "text-apex-muted",
                )}
              >
                No, not yet
              </button>
            </div>
          </Field>
          <Field label="Who referred you? *">
            <RecruiterCombobox
              value={recruiter}
              onChange={setRecruiter}
              invalid={errors.includes("who referred you")}
            />
            {invalidSlug && !recruiter && (
              <p className="mt-2 text-[12.5px] text-apex-muted">
                We couldn't match that referral link — search below, or type your recruiter's name
                and choose "Add" if they aren't listed yet.
              </p>
            )}
          </Field>
          <Field label="Instagram handle">
            <input
              className="apx-input"
              placeholder="@yourhandle (optional)"
              value={form.instagram_handle}
              onChange={(e) => set("instagram_handle", e.target.value)}
            />
          </Field>
          <Field label="Why do you want to work with APEX? *">
            <textarea
              className="apx-input"
              rows={4}
              value={form.why_text}
              onChange={(e) => set("why_text", e.target.value)}
            />
          </Field>
          <label className="flex items-start gap-3 text-[14px] leading-relaxed text-apex-fog">
            <input
              type="checkbox"
              checked={form.consent_contact}
              onChange={(e) => set("consent_contact", e.target.checked)}
              className="mt-1 h-4 w-4 accent-apex-gold"
            />
            I agree to be contacted by APEX Financial about agent opportunities and confirm my
            information is accurate. *
          </label>

          {errors.length > 0 && (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3.5 text-[13.5px] text-red-200">
              Please add {errors.join(", ")}.
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={submitting}
            className="apx-btn-primary mt-2 w-full px-6 py-4 text-[16px] disabled:opacity-60"
          >
            {submitting ? (
              "Submitting…"
            ) : (
              <>
                Submit Application <span>→</span>
              </>
            )}
          </button>
          <p className="text-center text-[12px] text-apex-faint">
            By applying you agree to be contacted about agent opportunities. No spam.
          </p>

          <div className="mt-2 text-center text-[13px] text-apex-faint">
            Already an agent?{" "}
            <Link to="/login" className="text-apex-gold hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
