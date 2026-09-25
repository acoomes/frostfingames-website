# frostfingames.com

The Frostfin Games studio site. Plain static HTML, CSS and a little JS, plus one
Cloudflare Pages Function for email signups. No build step and no dependencies.

## What's on the page

| Section | Games | Source repo |
|---|---|---|
| Flagship | **Cookiss** (cozy cookie clicker, Unity) | `acoomes/clickie-cooker` |
| On the workbench | **Shelf Control**, **Ember & Bone**, **Sigil Strike**, **ECHO** | `shelf-control`, `hearth-harrow`, `sigil-strike`, `echo-game` |
| Arcade (play now) | **Perfect Pulse** (hosted here), **Paper 86** (Vercel) | `perfect-pulse`, `paper-86` |
| Lab mentions | Roll Them Bones!, Tiny Tide | `roll-them-bones`, `tiny-tide` |

`play/perfect-pulse/` is a vendored copy of `acoomes/perfect-pulse` at `c93ccef`
(only `index.html` was changed, to add metadata and a back link). The game repo is
the source of truth; copy `game.js`/`style.css` over again when it ships a release.

Images in `assets/img/` are WebP exports of each game's own art or gameplay captures.

## Preview locally

```sh
python3 -m http.server 8080          # static only
npx wrangler pages dev . --kv SIGNUPS # with the signup API, redirects and headers
```

## Deploy on Cloudflare Pages

1. Workers & Pages > Create > Pages > Connect to Git > `acoomes/frostfingames-website`.
2. Framework preset: **None**. Build command: *(empty)*. Output directory: `/`.
3. Storage & Databases > KV > create a namespace called `frostfin-signups`.
4. Pages project > Settings > Bindings > add **KV namespace**, variable name `SIGNUPS`,
   pointing at that namespace. Redeploy.
5. Custom domains > add `frostfingames.com` and `www.frostfingames.com`.

Until step 4 is done, the forms politely tell people to email hello@ instead.

## Reading the signup list

Each signup is one KV key (the lowercased email) whose value records which form(s)
it came from (`cookiss` or `studio`), first/last signup time, and country.

```sh
npx wrangler kv key list --namespace-id <id>                   # all emails + sources
npx wrangler kv key get --namespace-id <id> "someone@example.com"
```

When the list outgrows KV, export it into a real newsletter tool (Buttondown, Kit, etc.).

## Files

- `index.html` – the page
- `assets/site.css`, `assets/site.js` – styles and form enhancement
- `assets/fonts/` – self-hosted Bricolage Grotesque + Figtree (OFL, licenses included)
- `functions/api/subscribe.js` – `POST /api/subscribe`
- `_headers` – security headers (strict CSP: everything is same-origin) and caching
- `_redirects` – short links: `/cookiss`, `/games`, `/arcade`, `/press`, `/perfect-pulse`
- `404.html` – "Lost at sea"
