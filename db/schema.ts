import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const papers = pgTable("papers", {
  id: serial().primaryKey(),
  reference: text("reference").unique(),
  title: text("title").notNull(),
  authors: text("authors").notNull(),
  abstract: text("abstract").notNull(),
  keywords: text("keywords"),
  paperType: text("paper_type").notNull().default("article"),
  submitterName: text("submitter_name").notNull(),
  submitterEmail: text("submitter_email").notNull(),
  institution: text("institution"),
  coverLetter: text("cover_letter"),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  fileType: text("file_type").notNull(),
  status: text("status").notNull().default("submitted"),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

// Per-year counter for generating ERPI-YYYY-NNNNN references. One row per
// calendar year; last_seq is bumped atomically on each submission so the
// sequence resets to 1 at the start of every year.
export const referenceCounters = pgTable("reference_counters", {
  year: integer("year").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});

// Append-only status timeline. The initial "submitted" row is author-visible;
// subsequent rows are written on every editor status change. author_visible
// controls whether a row is shown on the public /track timeline.
export const submissionStatusHistory = pgTable("submission_status_history", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .references(() => papers.id),
  status: text("status").notNull(),
  note: text("note"),
  authorVisible: boolean("author_visible").notNull().default(false),
  changedAt: timestamp("changed_at").defaultNow(),
});
