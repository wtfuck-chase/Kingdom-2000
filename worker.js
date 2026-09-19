/**
 * Kingdom 2000 — transfer application endpoint
 * Cloudflare Worker. Receives the form POST from the site, drops a card into the
 * transfer officers' Discord channel, and sends the applicant to /applied.html.
 *
 * Deploy:
 *   1. Cloudflare dashboard -> Workers & Pages -> Create Worker -> paste this file.
 *   2. Settings -> Variables -> add a SECRET named DISCORD_WEBHOOK
 *      (Discord: channel -> Edit Channel -> Integrations -> Webhooks -> New -> Copy URL).
 *   3. Settings -> Variables -> add a plaintext var SITE_ORIGIN = https://kingdom2000.pages.dev
 *   4. Copy the worker URL and paste it into the <form action="..."> in index.html.
 */

const FIELDS = [
  ["governor",  "Governor",        true],
  ["kingdom",   "From kingdom",    true],
  ["power",     "Power",           true],
  ["tc",        "Town Center",     true],
  ["passes",    "Passes held",     false],
  ["timezone",  "Timezone",        true],
  ["discord",   "Discord",         false],
  ["alliance",  "Preference",      false],
  ["notes",     "Notes",           false],
];

export default {
  async fetch(request, env) {
    const origin = env.SITE_ORIGIN || "https://kingdom2000.pages.dev";

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), origin);
    if (request.method !== "POST") return redirect(origin + "/");

    let form;
    try {
      const ct = request.headers.get("content-type") || "";
      form = ct.includes("application/json")
        ? new Map(Object.entries(await request.json()))
        : await request.formData();
    } catch {
      return redirect(origin + "/?error=badrequest");
    }
    const get = (k) => String((form.get(k) ?? "")).trim().slice(0, 500);

    // Honeypot. Real people never fill this in; bots always do.
    if (get("sigil")) return redirect(origin + "/applied.html");

    // Required fields
    for (const [key, , required] of FIELDS) {
      if (required && !get(key)) return redirect(origin + "/#apply?error=missing");
    }

    // Crude flood guard: one submission per IP per 60s, held in a KV namespace if bound.
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (env.RATE) {
      const seen = await env.RATE.get(ip);
      if (seen) return redirect(origin + "/applied.html");
      await env.RATE.put(ip, "1", { expirationTtl: 60 });
    }

    const lines = FIELDS
      .filter(([k]) => get(k))
      .map(([k, label]) => `**${label}:** ${clean(get(k))}`)
      .join("\n");

    const payload = {
      username: "Kingdom 2000 transfers",
      embeds: [{
        title: `New application — ${clean(get("governor"))}`,
        description: lines,
        color: 0x8a2a2a,
        footer: { text: `From ${request.cf?.country || "??"} · ${new Date().toISOString().slice(0, 16)}Z` },
      }],
    };

    if (env.DISCORD_WEBHOOK) {
      try {
        await fetch(env.DISCORD_WEBHOOK, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        // Never fail the applicant because Discord is down; log and continue.
        console.error("webhook failed", e);
      }
    }

    return redirect(origin + "/applied.html");
  },
};

// Strip Discord markdown and mentions out of user input.
function clean(s) {
  return s.replace(/[@`*_~|\\]/g, "").replace(/\r?\n/g, " ").slice(0, 400) || "—";
}
function redirect(url) {
  return new Response(null, { status: 303, headers: { Location: url } });
}
function cors(res, origin) {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  return res;
}
