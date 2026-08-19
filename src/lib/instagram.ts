/** Helpers for displaying and linking Instagram handles. */

export function instagramLabel(handle?: string | null): string {
  const h = (handle ?? "").trim().replace(/^@+/, "").replace(/\/+$/, "");
  if (!h) return "";
  // Accept pasted profile URLs too.
  const fromUrl = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const user = fromUrl ? fromUrl[1] : h;
  return `@${user}`;
}

export function instagramUrl(handle?: string | null): string | undefined {
  const label = instagramLabel(handle);
  if (!label) return undefined;
  return `https://instagram.com/${label.slice(1)}`;
}
