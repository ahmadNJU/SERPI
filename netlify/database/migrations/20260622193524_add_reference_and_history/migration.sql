CREATE TABLE "reference_counters" (
	"year" integer PRIMARY KEY,
	"last_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_status_history" (
	"id" serial PRIMARY KEY,
	"submission_id" integer NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"author_visible" boolean DEFAULT false NOT NULL,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "papers" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_reference_key" UNIQUE("reference");--> statement-breakpoint
ALTER TABLE "submission_status_history" ADD CONSTRAINT "submission_status_history_submission_id_papers_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "papers"("id");--> statement-breakpoint
-- Backfill ERPI-YYYY-NNNNN references for existing rows, numbered per
-- submission year in chronological order.
UPDATE "papers" AS p
SET "reference" = 'ERPI-' || o.yr || '-' || LPAD(o.seq::text, 5, '0')
FROM (
	SELECT "id",
		EXTRACT(YEAR FROM COALESCE("submitted_at", now()))::int AS yr,
		ROW_NUMBER() OVER (
			PARTITION BY EXTRACT(YEAR FROM COALESCE("submitted_at", now()))::int
			ORDER BY "submitted_at" ASC NULLS LAST, "id" ASC
		) AS seq
	FROM "papers"
) AS o
WHERE p."id" = o."id" AND p."reference" IS NULL;--> statement-breakpoint
-- Seed the per-year counters from the highest sequence already assigned.
INSERT INTO "reference_counters" ("year", "last_seq")
SELECT EXTRACT(YEAR FROM COALESCE("submitted_at", now()))::int AS yr,
	COUNT(*)::int AS cnt
FROM "papers"
GROUP BY EXTRACT(YEAR FROM COALESCE("submitted_at", now()))::int
ON CONFLICT ("year") DO UPDATE SET "last_seq" = EXCLUDED."last_seq";--> statement-breakpoint
-- Seed an author-visible initial "submitted" history row for existing rows.
INSERT INTO "submission_status_history" ("submission_id", "status", "note", "author_visible", "changed_at")
SELECT p."id", 'submitted', NULL, true, COALESCE(p."submitted_at", now())
FROM "papers" AS p
WHERE NOT EXISTS (
	SELECT 1 FROM "submission_status_history" AS h WHERE h."submission_id" = p."id"
);