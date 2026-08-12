import { resolveMedia } from "@/lib/academy/media";

/** Plays academy audio. Direct/storage URLs use a native <audio> element;
 *  share links (Drive, Vimeo, Loom, YouTube) can only play in their embed. */
export function AudioBlock({
  url,
  title,
  nativeRef,
  frameRef,
}: {
  url?: string | null;
  title?: string;
  nativeRef?: React.Ref<HTMLAudioElement>;
  frameRef?: React.Ref<HTMLIFrameElement>;
}) {
  if (!url?.trim()) return <div className="p-muted">No audio attached yet.</div>;
  const media = resolveMedia(url);

  if (media.embedUrl) {
    return (
      <iframe
        ref={frameRef}
        src={media.embedUrl}
        title={title ?? "Audio"}
        allow="autoplay; encrypted-media"
        className="h-[120px] w-full"
        style={{ border: 0, background: "var(--p-raised)" }}
      />
    );
  }

  return (
    <audio ref={nativeRef} controls preload="metadata" src={media.playbackUrl ?? url} className="w-full">
      <a href={url} target="_blank" rel="noreferrer">
        Open audio
      </a>
    </audio>
  );
}
