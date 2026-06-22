import type { Config } from "@netlify/functions";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { papers, submissionStatusHistory } from "../../db/schema.js";
import { clientIp, rateLimit } from "../lib/ratelimit.js";

// Deliberately generic: never confirm a reference or an email independently.
const NO_MATCH = { found: false as const, message: "No matching submission was found. Please check your reference and email." };

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!rateLimit(`track:${clientIp(req)}`, 12, 60_000)) {
    return Response.json({ error: "Too many attempts. Please wait a minute and try again." }, { status: 429 });
  }

  let body: { reference?: unknown; email?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json(NO_MATCH, { status: 200 });
  }

  // Honeypot: real users never fill "website". Treat as a non-match.
  if (typeof body.website === "string" && body.website.trim()) {
    return Response.json(NO_MATCH, { status: 200 });
  }

  const reference = String(body.reference ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();

  // Shape check only — do not reveal whether either value exists.
  if (!/^ERPI-\d{4}-\d{5}$/.test(reference) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(NO_MATCH, { status: 200 });
  }

  const [paper] = await db
    .select({
      id: papers.id,
      reference: papers.reference,
      title: papers.title,
      paperType: papers.paperType,
      status: papers.status,
      submittedAt: papers.submittedAt,
    })
    .from(papers)
    .where(
      and(
        eq(papers.reference, reference),
        eq(sql`lower(${papers.submitterEmail})`, email)
      )
    );

  if (!paper) {
    return Response.json(NO_MATCH, { status: 200 });
  }

  const timeline = await db
    .select({
      status: submissionStatusHistory.status,
      note: submissionStatusHistory.note,
      changedAt: submissionStatusHistory.changedAt,
    })
    .from(submissionStatusHistory)
    .where(
      and(
        eq(submissionStatusHistory.submissionId, paper.id),
        eq(submissionStatusHistory.authorVisible, true)
      )
    )
    .orderBy(asc(submissionStatusHistory.changedAt));

  // No file links, no email, no internal (non-visible) notes.
  return Response.json({
    found: true,
    submission: {
      reference: paper.reference,
      title: paper.title,
      paperType: paper.paperType,
      status: paper.status,
      submittedAt: paper.submittedAt,
    },
    timeline,
  });
};

export const config: Config = {
  path: "/api/track",
};
