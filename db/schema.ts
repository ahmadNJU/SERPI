import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const papers = pgTable("papers", {
  id: serial().primaryKey(),
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
