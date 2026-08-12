import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public, token-gated recruiting actions the applicant performs from an email.
 * No applicant ID is ever accepted from the browser — only single-use tokens.
 */

export type CoursePurchaseResult = {
  ok: boolean;
  first_name?: string | null;
  already?: boolean;
  reason?: "invalid" | "expired";
};

export const confirmCoursePurchase = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(d))
  .handler(async ({ data }): Promise<CoursePurchaseResult> => {
    const engine = await import("@/lib/recruiting/stage-engine.server");
    const claim = await engine.claimActionToken(data.token, "course_purchased");
    if (!claim.ok) return { ok: false, reason: claim.reason };

    const applicant = await engine.loadApplicant(claim.applicantId);
    if (!applicant) return { ok: false, reason: "invalid" };

    if (!claim.firstClaim) {
      return { ok: true, already: true, first_name: applicant.first_name };
    }

    await engine.logActivity(
      claim.applicantId,
      "course_confirmed",
      "Licensing Course Confirmed",
      { source: "email_link" },
    );
    await engine.applyStage({
      applicantId: claim.applicantId,
      stage: "pre-licensing",
      reason: "course_confirmed",
      patch: { course_confirmed_at: new Date().toISOString() },
      sendKey: `pre-licensing:${claim.applicantId}`,
    });

    return { ok: true, already: false, first_name: applicant.first_name };
  });
