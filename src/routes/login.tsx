import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell } from "@/components/vantage/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Agent login — Vantage Financial" },
      { name: "description", content: "Sign in to the Vantage Financial agent portal." },
      { property: "og:title", content: "Vantage agent login" },
      { property: "og:description", content: "Sign in to the Vantage Financial agent portal." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    navigate({ to: "/portal" });
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[520px] px-6 pt-16 pb-24 md:px-8">
        <div className="vantage-card p-8 md:p-10">
          <div className="vantage-kicker mb-2">Agent portal</div>
          <h1 className="font-display text-[clamp(32px,5vw,44px)] leading-none">Sign in</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-vantage-muted">
            Use the email your account is registered with.
          </p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <label>
              <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">Email</span>
              <input type="email" required className="vantage-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-vantage-muted">Password</span>
              <input type="password" required className="vantage-input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3 text-[13.5px] text-red-200">{error}</div>}
            <button disabled={busy} className="vantage-btn-primary mt-2 w-full px-6 py-4 text-[15px] disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in →"}
            </button>
          </form>
          <div className="mt-6 rounded-[10px] border border-white/8 bg-white/[0.02] p-3.5 text-[13px] leading-relaxed text-vantage-muted">
            New agent? You don't have a password yet — use the{" "}
            <span className="text-vantage-fog">“Set up your account”</span> link in your onboarding
            email to create one. If you can't find it, ask your recruiter to resend your invitation.
          </div>
          <div className="mt-5 flex items-center justify-between text-[13px] text-vantage-faint">
            <Link to="/" className="hover:text-vantage-gold">← Back to Vantage</Link>
          </div>

        </div>
      </div>
    </PublicShell>
  );
}
