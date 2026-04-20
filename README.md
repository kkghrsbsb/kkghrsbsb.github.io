# kkghrsbsb.github.io

Personal blog built with Astro.

This project is based on an existing Astro blog template and extended with a music player, a comments system and UI/UX customizations.

## Stack

- Framework: Astro
- Music Player: APlayer
- Playlist API: Meting API (NetEase Cloud Music)
- Comments System: giscus (Github Discussions)

## Base Template

This blog is built on top of:

- astro-erudite  
  https://github.com/jktrn/astro-erudite

The template is customized mainly in:
- [Astro](https://astro.build/)'s [Islands](https://docs.astro.build/en/concepts/islands/) architecture for selective hydration and client-side interactivity while maintaining fast static site rendering.
- [shadcn/ui](https://ui.shadcn.com/) with [Tailwind](https://tailwindcss.com/) color conventions for automatic light and dark theme styling. Features accessible, theme-aware UI components for navigation, buttons, and more.
- [Expressive Code](https://expressive-code.com/) for enhanced code block styling, syntax highlighting, and code block titles.
- Blog authoring with [MDX](https://mdxjs.com/) for component-rich content and $\LaTeX$ math rendering via [KaTeX](https://katex.org/).
- Astro [View Transitions](https://docs.astro.build/en/guides/view-transitions/) in <abbr title="Single Page Application">SPA</abbr> mode for smooth route animations.
- SEO optimization with granular metadata and [Open Graph](https://ogp.me/) tag control for each post.
- [RSS](https://en.wikipedia.org/wiki/RSS) feed and sitemap generation.
- Subpost support for breaking long content into digestible parts and organizing related series.
- Author profiles with a dedicated authors page and multi-author post support.
- Project tags with a dedicated tags page for post categorization and discovery.
- Custom Callout component variants for enhanced technical writing.


## Music Player

The homepage integrates **APlayer**:

- https://github.com/DIYgod/APlayer

Features:
- playlist
- lyrics (LRC)
- progress / volume control

Personal Customizations:
- unified accent color via CSS variables
- light/dark theme adaptation (OKLCH-based)
- dark-mode hover and contrast fixes
- removal of default bright borders, shadows, and scrollbar issues

## Playlist Data

Music data is provided by **Meting API**:

- https://github.com/injahow/meting-api

Used only as an external API service to fetch NetEase Cloud Music playlists.

## Giscus

A comments system powered by [GitHub Discussions][discussions]. Let visitors leave comments and reactions on your website via GitHub! Heavily inspired by [utterances][utterances].

- https://github.com/giscus/giscus

Features:
- [Open source][repo]. 🌏
- No tracking, no ads, always free. 📡 🚫
- No database needed. All data is stored in GitHub Discussions. :octocat:
- Supports [custom themes][creating-custom-themes]! 🌗
- Supports [multiple languages][multiple-languages]. 🌐
- [Extensively configurable][advanced-usage]. 🔧
- Automatically fetches new comments and edits from GitHub. 🔃
- [Can be self-hosted][self-hosting]! 🤳

[giscus]: https://giscus.app
[discussions]: https://docs.github.com/en/discussions
[utterances]: https://github.com/utterance/utterances
[repo]: https://github.com/giscus/giscus
[advanced-usage]: https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md
[creating-custom-themes]: https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md#data-theme
[multiple-languages]: https://github.com/giscus/giscus/blob/main/CONTRIBUTING.md#adding-localizations
[self-hosting]: https://github.com/giscus/giscus/blob/main/SELF-HOSTING.md

## flexsearch

Next-Generation full-text search library for Browser and Node.js

- https://github.com/nextapps-de/flexsearch

Create a search box embedded in blog/ page, allowing users to search for blog posts by title, tags, and description ...

## Writer

A lightweight in-browser Markdown editor for publishing posts directly to GitHub, protected by GitHub OAuth.

**Entry point** — `WriterFAB` (React Island, `client:only="react"`) renders a fixed FAB button at bottom-left. Unauthenticated visitors see a semi-transparent lock icon; clicking it initiates GitHub OAuth. Authenticated users see an edit icon that navigates to `/write`.

**Standalone page** — `/write` (`src/pages/write.astro`) is a bare HTML page (no Layout wrapper, `height: 100dvh`, `overflow: hidden`) that mounts `WriterPage`. This avoids the mobile scroll-through problem that a full-screen overlay would cause.

**Auth flow** — GitHub OAuth with `gist` scope. The Cloudflare Worker at `WORKER_URL` exchanges the OAuth code for an access token and stores the session in KV. `localStorage` holds `writer_session` on the client; the Worker validates it on each publish request.

**Editor** — Split-pane on desktop (editor left, preview right), tab-switching on mobile. Preview uses `marked` with GFM enabled. Editor and preview scroll positions are synchronized via scroll-percentage to avoid ping-pong.

**Publish** — Builds a Markdown file with YAML frontmatter (title, slug, description, tags, date, cover image path), then calls the Worker to commit it to the GitHub repo via the Contents API.

Key files:
- `src/components/WriterFAB.tsx` — FAB button, OAuth redirect
- `src/components/WriterPage.tsx` — full editor UI
- `src/pages/write.astro` — standalone page shell
- `src/lib/writer-config.ts` — `GITHUB_CLIENT_ID`, `WORKER_URL`, `OAUTH_SCOPE`

## Calico Cat Pet

An interactive pixel-art calico cat (`三花猫`) that lives on the polaroid photo frame on the homepage.

**Rendering** — Pure inline SVG on a 10×15 pixel grid (4 px/pixel, viewBox `0 0 46 62`, displayed at 56 px). No external images or JS libraries. Three-color calico pattern: cream base, orange right-side patches, black right ear and lower-left body patch.

**Appear animation** — 1 second after page load, the cat jumps out from inside the frame (`translateY` + `scaleY` spring, `cubic-bezier(0.34, 1.5, 0.64, 1)`). The appear animation is isolated to a `.pet-appearing` class that JS adds and removes, preventing it from restarting when other animation classes are toggled.

**Walk interaction** — Clicking anywhere on `.frame` (the polaroid element) causes the cat to walk horizontally to the clicked X position along the bottom edge. Key details:
- After appear, positioning switches from `right: 12px` to an equivalent `left: Npx` so JS can freely update the horizontal coordinate.
- Movement uses a `requestAnimationFrame` loop with ease-in-out easing at 110 px/s. Mid-walk clicks cancel the current RAF and redirect immediately.
- Walking direction is injected as a CSS custom property (`--pet-dir: 1 | -1`) on the wrapper; the walk-bob keyframes read it via `scaleX(var(--pet-dir))` to flip the sprite without a separate DOM element.
- On arrival: squat-and-bounce landing animation, direction resets to front-facing, tail wag resumes.

**Tail wag** — CSS `animation` on the `<g class="pet-tail">` SVG element, initially `animation-play-state: paused`. JS sets it to `running` after the appear animation completes, and pauses it again during walking.

**Accessibility** — `prefers-reduced-motion`: skips all animations, shows the cat immediately, teleports instead of walking. The wrapper has `aria-hidden="true"`.

Key files:
- `src/components/FramePet.astro` — SVG, CSS animations, JS interaction logic
- `src/pages/index.astro` — mounts `<FramePet />` inside `<figure class="frame">`
