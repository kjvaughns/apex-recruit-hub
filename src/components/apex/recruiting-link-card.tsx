import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRecruitingLink } from "@/lib/portal.functions";

function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function useRecruitingLink() {
  const getFn = useServerFn(getMyRecruitingLink);
  const q = useQuery({ queryKey: ["me", "recruiting-link"], queryFn: () => getFn() });
  const origin = useOrigin();
  const slug = q.data?.recruiting_slug ?? null;
  const link = slug && origin ? `${origin}/?ref=${slug}` : "";
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  return { q, slug, link, canShare };
}

async function copyText(text: string, done: () => void) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    /* clipboard blocked — user can still select the text */
  }
}

async function shareLink(link: string) {
  if (!link) return;
  try {
    await navigator.share({ title: "Apply to Vantage Financial", url: link });
  } catch {
    /* share cancelled/unsupported */
  }
}

/**
 * The agent's personal recruiting link. `full` = the standalone card
 * (Dashboard, Settings); `compact` = a slim inline bar for dense toolbars.
 * Reuses getMyRecruitingLink — no new data logic.
 */
export function RecruitingLinkCard({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { q, slug, link, canShare } = useRecruitingLink();
  const [copied, setCopied] = useState(false);
  const copy = () => copyText(link, () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  });

  if (variant === "compact") {
    return (
      <div className="apx-card flex flex-wrap items-center gap-2 p-2.5 pl-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-apex-faint">
          Your link
        </span>
        {q.isLoading ? (
          <span className="text-[12.5px] text-apex-dim">Loading…</span>
        ) : !slug ? (
          <span className="text-[12.5px] text-apex-muted">Not set up yet — ask an administrator.</span>
        ) : (
          <>
            <input
              className="apx-input h-9 min-w-[180px] flex-1 text-[12.5px]"
              readOnly
              value={link || "…"}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button onClick={copy} disabled={!link} className="apx-btn-primary px-3.5 py-2 text-[12px] disabled:opacity-60">
              {copied ? "Copied!" : "Copy"}
            </button>
            {canShare && (
              <button onClick={() => shareLink(link)} className="apx-btn-ghost px-3.5 py-2 text-[12px]">
                Share
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="apx-card p-6 md:p-8">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-apex-faint">
        Recruiting
      </div>
      <h2 className="font-display text-[26px] leading-none">Your recruiting link</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-apex-muted">
        Share this link with prospects. Anyone who applies through it is automatically attributed to
        you.
      </p>

      {q.isLoading ? (
        <div className="mt-5 text-apex-dim">Loading…</div>
      ) : !slug ? (
        <p className="mt-5 text-[14px] text-apex-muted">
          Your recruiting link isn't set up yet. Ask an administrator to enable it.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              className="apx-input flex-1"
              readOnly
              value={link || "…"}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-3">
              <button onClick={copy} disabled={!link} className="apx-btn-primary px-5 disabled:opacity-60">
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a href={link || "#"} target="_blank" rel="noreferrer noopener" className="apx-btn-ghost flex items-center px-5">
                Open
              </a>
              {canShare && (
                <button onClick={() => shareLink(link)} className="apx-btn-ghost px-5">
                  Share
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
            <span className="rounded-full border border-[var(--apx-hairline)] px-2.5 py-1 text-apex-fog">
              Applicants generated:{" "}
              <span className="font-semibold text-apex-ivory">{q.data?.applicant_count ?? 0}</span>
            </span>
            {!q.data?.can_receive_applicants && (
              <span className="text-apex-faint">
                Note: new applicants are currently paused for your profile.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
