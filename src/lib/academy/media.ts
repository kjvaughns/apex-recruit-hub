/** Client-safe media source helpers for Vantage Academy.
 *  Recognises the sharing URLs admins actually paste and derives:
 *   - an embeddable URL for playback
 *   - a fetchable URL for transcription (when one exists) */

export type MediaKind = "drive" | "youtube" | "vimeo" | "loom" | "direct" | "unknown";

export const SUPPORTED_SOURCES = [
  "Google Drive share link (anyone with the link)",
  "Vimeo link",
  "Loom link",
  "YouTube (public or unlisted) link",
  "Direct video URL (.mp4, .mov, .webm)",
  "Direct audio URL (.mp3, .m4a, .wav)",
  "Uploaded file (stored in Vantage Academy)",
];

const DIRECT_RE = /\.(mp4|m4v|mov|webm|ogv|mp3|m4a|wav|aac|flac|ogg)(\?|#|$)/i;

export function driveFileId(url: string): string | null {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{10,})/) ||
    url.match(/drive\.google\.com\/uc\?(?:export=\w+&)?id=([a-zA-Z0-9_-]{10,})/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  return m ? m[1] : null;
}

export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/) ||
    url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
    url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  return m ? m[1] : null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  return m ? m[1] : null;
}

export function loomId(url: string): string | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]{10,})/);
  return m ? m[1] : null;
}

export type ResolvedMedia = {
  kind: MediaKind;
  /** URL to render in an iframe (embed) — null when we play natively. */
  embedUrl: string | null;
  /** URL a <video>/<audio> element can play directly — null when embed-only. */
  playbackUrl: string | null;
  /** URL a transcription service can download — null when not fetchable. */
  fetchUrl: string | null;
};

export function resolveMedia(rawUrl?: string | null): ResolvedMedia {
  const url = (rawUrl ?? "").trim();
  if (!url) return { kind: "unknown", embedUrl: null, playbackUrl: null, fetchUrl: null };

  const drive = driveFileId(url);
  if (drive) {
    return {
      kind: "drive",
      embedUrl: `https://drive.google.com/file/d/${drive}/preview`,
      playbackUrl: null,
      fetchUrl: `https://drive.usercontent.google.com/download?id=${drive}&export=download`,
    };
  }
  const yt = youtubeId(url);
  if (yt) {
    return {
      kind: "youtube",
      embedUrl: `https://www.youtube.com/embed/${yt}?rel=0&enablejsapi=1`,
      playbackUrl: null,
      fetchUrl: null,
    };
  }
  const vim = vimeoId(url);
  if (vim) {
    return {
      kind: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vim}?api=1&player_id=vantage-vimeo`,
      playbackUrl: null,
      fetchUrl: null,
    };
  }
  const loom = loomId(url);
  if (loom) {
    return { kind: "loom", embedUrl: `https://www.loom.com/embed/${loom}`, playbackUrl: null, fetchUrl: null };
  }
  if (DIRECT_RE.test(url) || /\/storage\/v1\/object\//.test(url)) {
    return { kind: "direct", embedUrl: null, playbackUrl: url, fetchUrl: url };
  }
  return { kind: "unknown", embedUrl: null, playbackUrl: url, fetchUrl: null };
}

/** Plain-language reason transcription can't run for a source, or null when it can. */
export function transcriptionBlocker(rawUrl?: string | null): string | null {
  const m = resolveMedia(rawUrl);
  if (!rawUrl?.trim()) return "Add a media link or upload a file first.";
  if (m.fetchUrl) return null;
  if (m.kind === "youtube") return "YouTube links can't be transcribed. Upload the file to Google Drive (or Vantage Academy) and paste that link instead.";
  if (m.kind === "vimeo" || m.kind === "loom")
    return `${m.kind === "vimeo" ? "Vimeo" : "Loom"} links can't be transcribed directly. Upload the original file to Google Drive (or Vantage Academy) and paste that link to transcribe.`;
  return "This link isn't a downloadable media file. Use a Google Drive share link, an uploaded file, or a direct .mp4 / .mp3 URL.";
}

export const TRANSCRIPT_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  queued: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Failed",
};

export function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
