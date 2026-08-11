# Fix link preview / OG image to show the actual logo

## Problem
When the Vantage Financial link is shared (iMessage, LinkedIn, Facebook, etc.), platforms generate a preview screenshot of the landing page instead of the brand logo because no `og:image` or `twitter:image` meta tag exists.

## Current state
- `public/vantage-logo.png` and `public/favicon.ico` exist.
- `src/routes/__root.tsx` sets favicon and apple-touch-icon to `/vantage-logo.png`, but sets **no** social preview image.
- `src/routes/index.tsx` sets `og:title` and `og:description`, but no `og:image`.
- `src/assets/apex-logo.asset.json` is a CDN-hosted logo asset.

## Plan

1. **Generate a proper OG card**
   - Create a 1200x630 branded Open Graph image: black background, APEX/Vantage logo, gold accent, and short tagline.
   - Save it as `public/apex-og.png` so it is available at a stable absolute path.

2. **Add social preview metadata to the landing page**
   - In `src/routes/index.tsx` `head()`, add:
     - `{ property: "og:image", content: "https://vantagefinancial.lovable.app/apex-og.png" }`
     - `{ name: "twitter:image", content: "https://vantagefinancial.lovable.app/apex-og.png" }`
     - `{ property: "og:image:width", content: "1200" }`
     - `{ property: "og:image:height", content: "630" }`
     - `{ name: "twitter:card", content: "summary_large_image" }`
   - Keep `og:title` and `og:description` already present.

3. **Ensure favicon also uses the real logo**
   - `__root.tsx` already points to `/vantage-logo.png`; verify it loads and leave it in place.

4. **Verify**
   - Run the build to confirm no metadata errors.
   - Optionally inspect the rendered `<head>` to confirm the tags are present.

## Outcome
Shared links will display the APEX/Vantage logo and branded preview card instead of a generic landing-page screenshot.
