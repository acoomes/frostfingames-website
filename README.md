# frostfingames.com

The Frostfin Games studio site. Plain static HTML, CSS and a little JS in `public/`,
plus one Cloudflare Pages Function (`functions/`) for email signups. No build step and
no dependencies. `wrangler.toml` holds the Pages config, including the KV binding.

## What's on the page

| Section | Games | Source repo |
|---|---|---|
| Flagship | **Cookiss** (cozy cookie clicker, Unity) | `acoomes/clickie-cooker` |
| On the workbench | **Shelf Control**, **Ember & Bone**, **Sigil Strike**, **ECHO** | `shelf-control`, `hearth-harrow`, `sigil-strike`, `echo-game` |
| Arcade (play now) | **Perfect Pulse** (hosted here), **Paper 86** (Vercel) | `perfect-pulse`, `paper-86` |
| Lab mentions | Roll Them Bones!, Tiny Tide | `roll-them-bones`, `tiny-tide` |

`public/play/perfect-pulse/` is a vendored copy of `acoomes/perfect-pulse` at `c93ccef`
(only `index.html` was changed, to add metadata and a back link). The game repo is
the source of truth; copy `game.js`/`style.css` over again when it ships a release.

Images in `public/assets/img/` are WebP exports of each game's own art or gameplay captures.

## Preview locally

```sh
npx wrangler pages dev          # full site: signup API, redirects, headers (reads wrangler.toml)
python3 -m http.server -d public 8080   # static pages only
```

## Deploy on Cloudflare Pages

Already done: the `frostfin-signups` KV namespace exists and `wrangler.toml` binds it
as `SIGNUPS`, so there is no binding to configure in the dashboard.

1. Workers & Pages > Create > Pages > Connect to Git > `acoomes/frostfingames-website`.
2. Project name: **`frostfingames`** (must match `name` in `wrangler.toml`).
   Production branch: `main`. Framework preset: **None**. Build command: *(empty)*.
   Output directory: `public`.
3. Custom domains > add `frostfingames.com` and `www.frostfingames.com`.

Every push to `main` redeploys. Other branches get preview URLs.

## Reading the signup list

Each signup is one KV key (the lowercased email) whose value records which form(s)
it came from (`cookiss` or `studio`), first/last signup time, and country.

```sh
npx wrangler kv key list --binding SIGNUPS --remote              # all emails + sources
npx wrangler kv key get --binding SIGNUPS --remote "someone@example.com"
```

When the list outgrows KV, export it into a real newsletter tool (Buttondown, Kit, etc.).

## Files

- `public/index.html` – the page
- `public/assets/site.css`, `public/assets/site.js` – styles and form enhancement
- `public/assets/fonts/` – self-hosted Bricolage Grotesque + Figtree (OFL, licenses included)
- `public/_headers` – security headers (strict CSP: everything is same-origin) and caching
- `public/_redirects` – short links: `/cookiss`, `/games`, `/arcade`, `/press`, `/perfect-pulse`
- `public/404.html` – "Lost at sea"
- `functions/api/subscribe.js` – `POST /api/subscribe`
- `wrangler.toml` – Pages project name, output dir, KV binding
