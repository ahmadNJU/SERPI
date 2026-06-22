CREATE TABLE "papers" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"authors" text NOT NULL,
	"abstract" text NOT NULL,
	"keywords" text,
	"paper_type" text DEFAULT 'article' NOT NULL,
	"submitter_name" text NOT NULL,
	"submitter_email" text NOT NULL,
	"institution" text,
	"cover_letter" text,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"file_type" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp DEFAULT now()
);
