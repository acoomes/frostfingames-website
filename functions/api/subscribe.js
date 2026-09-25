// Cloudflare Pages Function: POST /api/subscribe
//
// Stores each signup in the Workers KV namespace bound as SIGNUPS
// (Pages project > Settings > Bindings > KV namespace, variable name SIGNUPS).
// Key: the lowercased email. Value: JSON with source, time and country.
// Export later with: npx wrangler kv key list --namespace-id <id>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function onRequestPost({ request, env }) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  const reply = (ok, message, status) =>
    wantsJson
      ? Response.json({ ok, message }, { status })
      : Response.redirect(new URL(`/?subscribed=${ok ? 1 : 0}#signup`, request.url).toString(), 303);

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(false, 'That didn’t look like a signup form.', 400);
  }

  // Honeypot: real people never see this field. Pretend it worked.
  if (form.get('company')) return reply(true, 'You’re on the list. Talk soon!', 200);

  const email = String(form.get('email') || '').trim().toLowerCase();
  const source = String(form.get('source') || 'site').slice(0, 32);
  if (email.length > 254 || !EMAIL.test(email)) {
    return reply(false, 'That email doesn’t look quite right. Mind checking it?', 400);
  }

  if (!env.SIGNUPS) {
    return reply(false, 'Signups aren’t switched on yet. Email hello@frostfingames.com and we’ll add you by hand.', 503);
  }

  const existing = await env.SIGNUPS.get(email, 'json');
  const sources = new Set([...(existing?.sources || []), source]);
  await env.SIGNUPS.put(
    email,
    JSON.stringify({
      sources: [...sources],
      first: existing?.first || new Date().toISOString(),
      last: new Date().toISOString(),
      country: request.cf?.country || null,
    }),
    { metadata: { sources: [...sources] } },
  );

  return reply(true, existing ? 'You were already on the list. Now you’re extra on it.' : 'You’re on the list. Talk soon!', 200);
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
