import { createServerFn } from "@tanstack/react-start";
import type { OverviewSlot } from "@/lib/calendly.server";

export type { OverviewSlot };

/**
 * Public: the next few real Monday overview slots straight from Calendly.
 * Never throws — an empty list means "fall back to the plain booking link".
 */
export const getOverviewSlots = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchOverviewSlots } = await import("@/lib/calendly.server");
  const slots = await fetchOverviewSlots();
  return { slots };
});
