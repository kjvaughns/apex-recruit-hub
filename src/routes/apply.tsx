import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PublicShell } from "@/components/apex/brand";
import { submitApplication, lookupRecruiter } from "@/lib/applications.functions";

const searchSchema = z.object({
  ref: z.string().optional(),
});

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply — APEX Financial Empire" },
      { name: "description", content: "Apply to join the APEX Financial recruiting team. Three minutes, no résumé." },
      { property: "og:title", content: "Apply to APEX Financial" },
      { property: "og:description", content: "Three minutes. No résumé. A team lead follows up within one business day." },
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
  date_of_birth: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  licensed: boolean;
  referring_recruiter: string;
  why_text: string;
  consent_contact: boolean;
};

const initial: Form = {
  first_name: "", last_name: "", email: "", phone: "",
  date_of_birth: "", address: "", city: "", state: "", zip: "",
  licensed: false, referring_recruiter: "", why_text: "", consent_contact: false,
};

function ApplyPage() {
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const submit = useServerFn(submitApplication);
  const lookup = useServerFn(lookupRecruiter);

  const [form, setForm] = useState<Form>(initial);
  const [recruiterName, setRecruiterName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ref) return;
    setForm((f) => ({ ...f, referring_recruiter: ref }));
    lookup({ data: { slug: ref } }).then((r) => setRecruiterName(r.name)).catch(() => {});
  }, [ref, lookup]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit() {
    const errs: string[] = [];
    if (!form.first_name.trim()) errs.push("first name");
    if (!form.last_name.trim()) errs.push("last name");
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.push("a valid email");
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 7) errs.push("phone");
    if (!form.why_text.trim() || form.why_text.trim().length < 10) errs.push("a short reason (min 10 chars)");
    if (!form.consent_contact) errs.push("consent to be contacted");
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          date_of_birth: form.date_of_birth || "",
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          zip: form.zip.trim(),
          licensed: form.licensed,
          why_text: form.why_text.trim(),
          consent_contact: form.consent_contact,
          ref_slug: ref ?? "",
        },
      });
      sessionStorage.setItem("apex_applicant_first", form.first_name.trim());
      if (res.success_page_type === "licensed") {
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
          <h1 className="font-display text-[clamp(40px,6vw,68px)] leading-none">Your APEX application</h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-relaxed text-apex-muted">
            Three minutes. After you apply, you'll book a short overview call and we'll email you the details.
          </p>
          {recruiterName && (
            <p className="mt-5 text-[14px] text-apex-gold">
              Referred by <span className="font-semibold text-apex-ivory">{recruiterName}</span>
            </p>
          )}
        </div>

        <div className="apx-card mt-12 grid gap-4 p-6 md:p-10">
          <Field label="First name *">
            <input className="apx-input" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label="Last name *">
            <input className="apx-input" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
          <Field label="Email *">
            <input type="email" className="apx-input" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone *">
            <input type="tel" className="apx-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Date of birth">
            <input type="date" className="apx-input" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          </Field>
          <Field label="Street address">
            <input className="apx-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="City">
              <input className="apx-input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="State">
              <input className="apx-input" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="ZIP">
              <input className="apx-input" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
            </Field>
          </div>
          <Field label="Life insurance licensing">
            <select className="apx-input" value={form.licensed ? "yes" : "no"} onChange={(e) => set("licensed", e.target.value === "yes")}>
              <option value="no">Not licensed yet</option>
              <option value="yes">Licensed — life</option>
            </select>
          </Field>
          <Field label="Referring recruiter">
            <input className="apx-input" placeholder="Optional" value={form.referring_recruiter} onChange={(e) => set("referring_recruiter", e.target.value)} />
          </Field>
          <Field label="Why do you want to work with APEX? *">
            <textarea className="apx-input" rows={4} value={form.why_text} onChange={(e) => set("why_text", e.target.value)} />
          </Field>
          <label className="flex items-start gap-3 text-[14px] leading-relaxed text-apex-fog">
            <input type="checkbox" checked={form.consent_contact} onChange={(e) => set("consent_contact", e.target.checked)} className="mt-1 h-4 w-4 accent-apex-gold" />
            I agree to be contacted by APEX Financial about agent opportunities and confirm my information is accurate. *
          </label>

          {errors.length > 0 && (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3.5 text-[13.5px] text-red-200">
              Please add {errors.join(", ")}.
            </div>
          )}

          <button onClick={onSubmit} disabled={submitting} className="apx-btn-primary mt-2 w-full px-6 py-4 text-[16px] disabled:opacity-60">
            {submitting ? "Submitting…" : (<>Submit Application <span>→</span></>)}
          </button>
          <p className="text-center text-[12px] text-apex-faint">By applying you agree to be contacted about agent opportunities. No spam.</p>

          <div className="mt-2 text-center text-[13px] text-apex-faint">
            Already an agent? <Link to="/login" className="text-apex-gold hover:underline">Log in</Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-muted">{label}</span>
      {children}
    </label>
  );
}
