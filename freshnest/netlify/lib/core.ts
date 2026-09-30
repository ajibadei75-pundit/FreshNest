/* Shared pieces for the Netlify functions: site state, rate limits, alerts, and turning rows into the
   same JSON shapes the Node server sends, so public/ and public/admin/ work unchanged on both. */
import crypto from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings, feedback, projects, rateHits, siteState } from "../../db/schema.js";
import auth from "../../server/auth.js";
import { createNotifier } from "../../server/notify.js";
import { DEFAULT_SETTINGS } from "../../server/store.js";

export type State = typeof siteState.$inferSelect;
export type Settings = typeof DEFAULT_SETTINGS;

export const env = (k: string) => Netlify.env.get(k) || "";
export const newId = () => crypto.randomBytes(8).toString("hex");

/* PUBLIC_URL wins; otherwise the site's main Netlify address. */
export function publicUrl(): string {
  const ctx = Netlify.context;
  const fallback = ctx?.deploy?.context === "production" ? ctx?.site?.url || env("URL") : "";
  return (env("PUBLIC_URL") || fallback || "").replace(/\/+$/, "");
}

/* ---- Site state (one row) ---- */
export async function loadState(): Promise<State> {
  let [row] = await db.select().from(siteState).where(eq(siteState.id, 1));
  if (!row) {
    await db.insert(siteState)
      .values({ id: 1, secret: crypto.randomBytes(32).toString("hex"), adminHash: "", settings: structuredClone(DEFAULT_SETTINGS) })
      .onConflictDoNothing();
    [row] = await db.select().from(siteState).where(eq(siteState.id, 1));
  }
  /* Settings saved by an older version may miss newer fields */
  const s = (row.settings || {}) as Settings;
  row.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), s, { hours: Object.assign(structuredClone(DEFAULT_SETTINGS.hours), s.hours || {}) });
  return row;
}

/* ADMIN_PASSWORD always wins. Checked once per warm instance, because scrypt is deliberately slow. */
let syncedFor = "";
export async function syncEnvPassword(state: State): Promise<void> {
  const pw = env("ADMIN_PASSWORD");
  if (!pw || syncedFor === pw) return;
  if (!auth.verifyPassword(pw, state.adminHash)) {
    state.adminHash = auth.hashPassword(pw);
    await db.update(siteState).set({ adminHash: state.adminHash }).where(eq(siteState.id, 1));
  }
  syncedFor = pw;
}

/* ---- Rate limits shared by every function instance ---- */
export function hashKey(ip: string, state: State): string {
  return crypto.createHash("sha256").update(ip + state.secret).digest("hex").slice(0, 16);
}
export async function hit(bucket: string, key: string, max: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(rateHits)
    .where(and(eq(rateHits.bucket, bucket), eq(rateHits.key, key), gt(rateHits.at, since)));
  if (n >= max) return false;
  await db.insert(rateHits).values({ bucket, key });
  return true;
}
export async function resetHits(bucket: string, key: string): Promise<void> {
  await db.delete(rateHits).where(and(eq(rateHits.bucket, bucket), eq(rateHits.key, key)));
}
export async function pruneHits(): Promise<void> {
  await db.delete(rateHits).where(lt(rateHits.at, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

/* ---- Alerts: the result of the latest one is kept so the admin page can show failures ---- */
export function notifier() { return createNotifier(Netlify.env.toObject(), console); }
export async function notify(title: string, text: string): Promise<{ channel: string; ok: boolean; error?: string }[]> {
  const n = notifier();
  if (!n.channels.length) return [];
  const results = await n.notify(title, text);
  try { await db.update(siteState).set({ lastAlert: { at: new Date().toISOString(), title, results } }).where(eq(siteState.id, 1)); }
  catch (e) { console.error("Could not record the alert result:", e); }
  return results;
}

/* ---- Rows to the JSON shapes the site and admin page expect ---- */
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
export function bookingOut(b: typeof bookings.$inferSelect) {
  return { id: b.id, ref: b.ref, createdAt: iso(b.createdAt), updatedAt: iso(b.updatedAt), status: b.status, sel: b.sel, details: b.details, contact: b.contact,
    estimate: b.estimate, message: b.message, consent: b.consent, finalPrice: b.finalPrice, notes: b.notes } as any;
}
export function feedbackOut(f: typeof feedback.$inferSelect) {
  return { id: f.id, createdAt: iso(f.createdAt), status: f.status, rating: f.rating, tags: (f.tags as string[]) || [], text: f.text, name: f.name, service: f.service, allowPublic: f.allowPublic };
}
export function projectOut(p: typeof projects.$inferSelect) {
  return { id: p.id, createdAt: iso(p.createdAt), title: p.title, excerpt: p.excerpt, service: p.service, property: p.property, team: p.team, time: p.time,
    body: p.body, date: p.date, photo: p.photo, before: p.before, after: p.after, published: p.published };
}

/* A full copy of the data in the same layout as the Node server's db.json, minus the password hash and signing secret. */
export async function snapshot() {
  const state = await loadState();
  const [b, f, p] = await Promise.all([db.select().from(bookings), db.select().from(feedback), db.select().from(projects)]);
  return { meta: { createdAt: iso(state.createdAt), exportedAt: new Date().toISOString() }, settings: state.settings,
    bookings: b.map(bookingOut), feedback: f.map(feedbackOut), projects: p.map(projectOut) };
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Robots-Tag": "noindex",
};
