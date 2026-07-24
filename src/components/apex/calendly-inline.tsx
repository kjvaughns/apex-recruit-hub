import { useEffect } from "react";

export function CalendlyInline({ url, height = 720 }: { url: string; height?: number }) {
  useEffect(() => {
    const SRC = "https://assets.calendly.com/assets/external/widget.js";
    const w = window as unknown as { Calendly?: { initInlineWidgets?: () => void } };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      w.Calendly?.initInlineWidgets?.();
      return;
    }
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => w.Calendly?.initInlineWidgets?.();
    document.body.appendChild(s);
  }, [url]);

  return (
    <div className="apx-card mt-8 overflow-hidden p-2">
      <div
        className="calendly-inline-widget rounded-[14px]"
        data-url={url}
        style={{ minWidth: 320, width: "100%", height }}
      />
    </div>
  );
}
