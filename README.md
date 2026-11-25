# frostfingames.com

The Frostfin Games studio site. Plain static HTML, CSS and a little JS in `public/`,
plus one Cloudflare Pages Function (`functions/`) for email signups. No build step and
no dependencies. `wrangler.toml` holds the Pages config, including the KV binding.

## What's on the page

| Section | Games | Source repo |
|---|---|---|
| Flagship | **Paper 86** (drift score attack, live at paper86.app), with its trailer | `acoomes/paper-86` |
| Next in flight | **Cookiss** (cozy cookie clicker, Unity) | `acoomes/clickie-cooker` |
| On the workbench | **Shelf Control**, **Ember & Bone**, **ECHO** | `shelf-control`, `hearth-harrow`, `echo-game` |
| Lab footnote | Roll Them Bones!, Tiny Tide, and Perfect Pulse from the archive | `roll-them-bones`, `tiny-tide`, `perfect-pulse` |

`public/play/perfect-pulse/` is a vendored copy of `acoomes/perfect-pulse` at `c93ccef`
(only `index.html` was changed, to add metadata and a back link). It stays hosted so the
archive link works; it is not being developed.

`public/assets/video/paper86-trailer.mp4` is a copy of `marketing/paper86-trailer.mp4` from
the Paper 86 repo, and `paper86-hero.webp` / `paper86-poster.webp` are frames from it.
Copy it over again when the trailer is re-rendered.

Images in `public/assets/img/` are WebP exports of each game's own art or gameplay captures.

## Preview locally

```sh
npx wrangler pages dev          # full site: signup API, redirects, headers (reads wrangler.toml)
python3 -m http.server -d public 8080   # static pages only
```

## Hosting and deploys

Everything below is already set up in Cloudflare:

- **Pages project** `frostfingames` (direct upload), served at `frostfingames.pages.dev`,
  `frostfingames.com` and `www.frostfingames.com` (proxied CNAMEs in the zone).
- **KV namespace** `frostfin-signups`, bound as `SIGNUPS` through `wrangler.toml`.
- **Email Routing**: `hello@frostfingames.com` forwards to the owner's inbox.
- Zone settings: Always Use HTTPS on, minimum TLS 1.2.

Deploys run from `.github/workflows/deploy.yml` on every push: `main` goes to
production, other branches get preview URLs. It needs one repo secret,
`CLOUDFLARE_API_TOKEN`, holding a token with **Account > Cloudflare Pages > Edit**.
Without the secret the workflow skips instead of failing.

Manual deploy from a machine with wrangler logged in: `npx wrangler pages deploy --branch main`.

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
- `public/_redirects` – short links: `/paper86`, `/cookiss`, `/games`, `/press`, `/perfect-pulse`
- `public/404.html` – "Lost at sea"
- `functions/api/subscribe.js` – `POST /api/subscribe`
- `wrangler.toml` – Pages project name, output dir, KV binding
