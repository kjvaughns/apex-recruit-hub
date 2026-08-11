/**
 * Discord recruiting bot — posts a "new recruit" embed to a channel webhook.
 * Server-only: the webhook URL lives in system_settings and must never reach
 * the browser. Every failure is swallowed by the callers (notifications must
 * never break an application submission).
 */

export const DISCORD_WEBHOOK_SETTING_KEY = "discord_recruiting_webhook_url";

const GOLD = 0xc9a84c;

export type { RecruitAlert };

type _Unused = {
  firstName: string;
  lastName: string;
  recruiterName?: string | null;
  licensed: boolean;
  /** ISO-8601 overview slot they picked, when they picked one. */
  requestedOverviewAt?: string | null;
  wantsOneOnOne?: boolean;
  state?: string | null;
};

type MinimalClient = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: any }> };
    };
  };
};

/** Read the configured webhook URL (empty string / unset means "disabled"). */
export async function getDiscordWebhookUrl(supabase: MinimalClient): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", DISCORD_WEBHOOK_SETTING_KEY)
      .maybeSingle();
    const raw = typeof data?.value === "string" ? data.value : "";
    const url = raw.trim().replace(/^"|"$/g, "");
    return /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(url) ? url : null;
  } catch {
    return null;
  }
}

function buildPayload(a: RecruitAlert) {
  const name = `${a.firstName} ${a.lastName}`.trim() || "New recruit";
  return {
    username: "Vantage Recruiting",
    embeds: [
      {
        title: `New recruit — ${name}`,
        color: GOLD,
        fields: [
          { name: "Recruited by", value: a.recruiterName?.trim() || "Unassigned", inline: true },
          { name: "License", value: a.licensed ? "Licensed" : "Unlicensed", inline: true },
          { name: "Scheduled", value: scheduleLabel(a), inline: false },
          ...(a.state ? [{ name: "State", value: a.state, inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/** POST the embed. Returns false when no webhook is configured or the post fails. */
export async function postRecruitAlert(url: string, a: RecruitAlert): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(a)),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[discord] webhook post failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[discord] webhook post error:", e);
    return false;
  }
}

/** Convenience: look up the webhook and post, never throwing. */
export async function notifyNewRecruit(supabase: MinimalClient, a: RecruitAlert): Promise<void> {
  const url = await getDiscordWebhookUrl(supabase);
  if (!url) return;
  await postRecruitAlert(url, a);
}
