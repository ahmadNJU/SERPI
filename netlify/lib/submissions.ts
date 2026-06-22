import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { referenceCounters, submissionStatusHistory } from "../../db/schema.js";

/** Editorial statuses. Kept in sync with the selectors in /editor and labels in /track. */
export const ALLOWED_STATUSES = [
  "submitted",
  "with_editor",
  "under_review",
  "revisions_requested",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

export type Status = (typeof ALLOWED_STATUSES)[number];

export function isStatus(value: string): value is Status {
  return (ALLOWED_STATUSES as readonly string[]).includes(value);
}

/** ERPI-YYYY-NNNNN, e.g. ERPI-2026-00001. */
export function formatReference(year: number, seq: number): string {
  return `ERPI-${year}-${String(seq).padStart(5, "0")}`;
}

/**
 * Atomically claim the next per-year sequence number and return the formatted
 * reference. The upsert is a single statement, so concurrent submissions can
 * never receive the same number. The sequence resets to 1 each calendar year.
 */
export async function nextReference(year: number): Promise<string> {
  const [row] = await db
    .insert(referenceCounters)
    .values({ year, lastSeq: 1 })
    .onConflictDoUpdate({
      target: referenceCounters.year,
      set: { lastSeq: sql`${referenceCounters.lastSeq} + 1` },
    })
    .returning({ seq: referenceCounters.lastSeq });

  return formatReference(year, row.seq);
}

/** Append a row to the status timeline. */
export async function recordStatus(
  submissionId: number,
  status: string,
  note: string | null,
  authorVisible: boolean
): Promise<void> {
  await db.insert(submissionStatusHistory).values({
    submissionId,
    status,
    note: note && note.trim() ? note.trim() : null,
    authorVisible,
  });
}
