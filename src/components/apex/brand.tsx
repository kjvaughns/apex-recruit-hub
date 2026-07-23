import apexLogoAsset from "@/assets/apex-logo.asset.json";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const APEX_LOGO_URL = apexLogoAsset.url;

export function ApexLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return <img src={APEX_LOGO_URL} alt="APEX Financial Empire" className={className} />;
}

export function AuroraBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black">
      <div
        className="absolute -left-[12vw] -top-[16vw] h-[62vw] w-[62vw] rounded-full blur-[30px]"
        style={{
          background: "radial-gradient(circle,rgba(201,168,76,0.18),transparent 62%)",
          animation: "apx-aurora-a 24s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[16vw] top-[34vh] h-[54vw] w-[54vw] rounded-full blur-[30px]"
        style={{
          background: "radial-gradient(circle,rgba(201,168,76,0.11),transparent 62%)",
          animation: "apx-aurora-b 30s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-[22vw] left-[22vw] h-[50vw] w-[50vw] rounded-full blur-[30px]"
        style={{
          background: "radial-gradient(circle,rgba(150,118,44,0.13),transparent 62%)",
          animation: "apx-aurora-a 28s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}

export function PublicNav() {
  return (
    <div className="sticky top-0 z-50 border-b border-white/[0.07] backdrop-blur-xl" style={{ background: "rgba(7,7,7,0.55)" }}>
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-6 px-6 md:px-8">
        <Link to="/" className="flex items-center">
          <ApexLogo className="h-[42px] w-auto" />
        </Link>
        <nav className="flex items-center gap-4 md:gap-6">
          <a href="/#how" className="hidden text-[13.5px] font-semibold text-apex-dim transition hover:text-apex-ivory md:inline">
            How It Works
          </a>
          <a href="/#earnings" className="hidden text-[13.5px] font-semibold text-apex-dim transition hover:text-apex-ivory md:inline">
            Earnings
          </a>
          <a href="/#faq" className="hidden text-[13.5px] font-semibold text-apex-dim transition hover:text-apex-ivory md:inline">
            FAQ
          </a>
          <Link to="/login" className="text-[13.5px] font-semibold text-apex-dim transition hover:text-apex-ivory">
            Agent Login
          </Link>
          <Link to="/apply" className="apx-btn-primary px-5 py-[11px] text-[14px]">
            Apply Now <span>→</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function PublicFooter() {
  return (
    <div className="mx-auto mt-[72px] max-w-[1240px] px-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] py-8">
        <ApexLogo className="h-[34px] w-auto opacity-85" />
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-apex-faint">
          <span>© 2026 APEX Financial Empire</span>
          <span className="text-white/10">•</span>
          <Link to="/apply" className="text-apex-dim transition hover:text-apex-gold">
            Apply
          </Link>
          <span className="text-white/10">•</span>
          <span>Equal Opportunity</span>
        </div>
      </div>
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-apex-ivory">
      <AuroraBackdrop />
      <div className="relative z-10">
        <PublicNav />
        {children}
        <PublicFooter />
      </div>
    </div>
  );
}
