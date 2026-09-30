/* Netlify Database schema for FreshNest. The Node server in server/ keeps using data/db.json;
   on Netlify the same records live in these tables. Nested booking details stay as JSON, exactly
   as the website sends them, so the admin page sees the same shapes on both. */
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/* One row (id = 1): signing secret, admin password hash, business settings and the last alert result. */
export const siteState = pgTable("site_state", {
  id: integer().primaryKey(),
  secret: text().notNull(),
  adminHash: text("admin_hash").notNull().default(""),
  settings: jsonb().notNull(),
  lastAlert: jsonb("last_alert"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: text().primaryKey(),
  ref: text().notNull().unique(),
  status: text().notNull().default("new"),
  sel: jsonb().notNull(),
  details: jsonb().notNull(),
  contact: jsonb().notNull(),
  estimate: jsonb().notNull(),
  message: text().notNull().default(""),
  consent: jsonb().notNull(),
  finalPrice: integer("final_price"),
  notes: text().notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bookings_created_at_idx").on(t.createdAt), index("bookings_status_idx").on(t.status)]);

export const feedback = pgTable("feedback", {
  id: text().primaryKey(),
  status: text().notNull().default("pending"),
  rating: integer().notNull(),
  tags: jsonb().notNull().default([]),
  text: text().notNull().default(""),
  name: text().notNull().default(""),
  service: text().notNull().default(""),
  allowPublic: boolean("allow_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("feedback_status_idx").on(t.status)]);

export const projects = pgTable("projects", {
  id: text().primaryKey(),
  title: text().notNull(),
  excerpt: text().notNull().default(""),
  service: text().notNull().default(""),
  property: text().notNull().default(""),
  team: text().notNull().default(""),
  time: text().notNull().default(""),
  body: text().notNull().default(""),
  date: text().notNull(),
  photo: text().notNull().default(""),
  before: text().notNull().default(""),
  after: text().notNull().default(""),
  published: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Rate limits. Functions run on many short-lived instances, so the counts must be shared. Keys are hashed IPs. */
export const rateHits = pgTable("rate_hits", {
  id: serial().primaryKey(),
  bucket: text().notNull(),
  key: text().notNull(),
  at: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("rate_hits_lookup_idx").on(t.bucket, t.key, t.at)]);
