import { useEffect, useState } from "react";

export function CalendlyInline({ url, height = 630 }: { url: string; height?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = new URL(url);
      if (!u.searchParams.has("hide_event_type_details")) u.searchParams.set("hide_event_type_details", "1");
      if (!u.searchParams.has("hide_gdpr_banner")) u.searchParams.set("hide_gdpr_banner", "1");
      if (!u.searchParams.has("primary_color")) u.searchParams.set("primary_color", "e6b400");
      u.searchParams.set("embed_domain", window.location.host);
      u.searchParams.set("embed_type", "Inline");
      setSrc(u.toString());
    } catch {
      setSrc(url);
    }
  }, [url]);

  return (
    <div
      className="mt-8 overflow-hidden rounded-[14px] border border-apex-gold/25 bg-apex-card"
      style={{ height: `min(80vh, ${height}px)` }}
    >
      {src && (
        <iframe
          src={src}
          title="Schedule with Calendly"
          className="h-full w-full"
          style={{ border: 0, minWidth: 320 }}
          loading="lazy"
        />
      )}
    </div>
  );
}
