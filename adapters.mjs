/* Production adapters: storage on Netlify Blobs and email through Resend. */
import { getStore } from "@netlify/blobs";

export function blobsDb() {
  const stores = {};
  const S = (col) => (stores[col] ||= getStore({ name: "fn-" + col, consistency: "strong" }));
  return {
    async get(col, id) { return (await S(col).get(id, { type: "json" })) ?? null; },
    async set(col, id, value) { await S(col).setJSON(id, value); },
    async del(col, id) { await S(col).delete(id); },
    async list(col) {
      const { blobs } = await S(col).list();
      const items = await Promise.all(blobs.map((b) => S(col).get(b.key, { type: "json" })));
      return items.filter(Boolean);
    },
  };
}

export function resendMail(env) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return {
    async send({ to, subject, html, text, replyTo }) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html, text, reply_to: replyTo }),
      });
      if (!r.ok) throw new Error("Resend " + r.status + ": " + (await r.text()).slice(0, 200));
    },
  };
}

/* Optional AI helper (Anthropic). Without ANTHROPIC_API_KEY the site uses its built-in keyword reader instead. */
export function anthropicAi(env) {
  if (!env.ANTHROPIC_API_KEY) return null;
  return {
    async ask({ system, user, maxTokens = 700 }) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: env.AI_MODEL || "claude-haiku-4-5-20251001", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error("AI " + r.status);
      const j = await r.json();
      return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    },
  };
}
