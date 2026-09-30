CREATE TABLE "bookings" (
	"id" text PRIMARY KEY,
	"ref" text NOT NULL UNIQUE,
	"status" text DEFAULT 'new' NOT NULL,
	"sel" jsonb NOT NULL,
	"details" jsonb NOT NULL,
	"contact" jsonb NOT NULL,
	"estimate" jsonb NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"consent" jsonb NOT NULL,
	"final_price" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY,
	"status" text DEFAULT 'pending' NOT NULL,
	"rating" integer NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"service" text DEFAULT '' NOT NULL,
	"allow_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"service" text DEFAULT '' NOT NULL,
	"property" text DEFAULT '' NOT NULL,
	"team" text DEFAULT '' NOT NULL,
	"time" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"photo" text DEFAULT '' NOT NULL,
	"before" text DEFAULT '' NOT NULL,
	"after" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_hits" (
	"id" serial PRIMARY KEY,
	"bucket" text NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_state" (
	"id" integer PRIMARY KEY,
	"secret" text NOT NULL,
	"admin_hash" text DEFAULT '' NOT NULL,
	"settings" jsonb NOT NULL,
	"last_alert" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bookings_created_at_idx" ON "bookings" ("created_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" ("status");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" ("status");--> statement-breakpoint
CREATE INDEX "rate_hits_lookup_idx" ON "rate_hits" ("bucket","key","at");