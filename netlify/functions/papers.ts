import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { papers } from "../../db/schema.js";
import { isEditorAuthorized, unauthorized } from "../lib/auth.js";
import { ALLOWED_STATUSES, isStatus, recordStatus } from "../lib/submissions.js";

export default async (req: Request): Promise<Response> => {
  // Everything this endpoint returns (titles, authors, names, emails,
  // institutions) is privileged and must never be served without the token.
  if (!isEditorAuthorized(req)) {
    return unauthorized();
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id");

    if (idParam) {
      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return Response.json({ error: "Invalid id parameter" }, { status: 400 });
      }
      const [paper] = await db.select().from(papers).where(eq(papers.id, id));
      if (!paper) {
        return Response.json({ error: "Paper not found" }, { status: 404 });
      }
      return Response.json(paper);
    }

    const allPapers = await db
      .select({
        id: papers.id,
        reference: papers.reference,
        title: papers.title,
        authors: papers.authors,
        paperType: papers.paperType,
        submitterName: papers.submitterName,
        submitterEmail: papers.submitterEmail,
        institution: papers.institution,
        status: papers.status,
        submittedAt: papers.submittedAt,
        fileType: papers.fileType,
        fileName: papers.fileName,
      })
      .from(papers)
      .orderBy(desc(papers.submittedAt));

    return Response.json({ papers: allPapers, total: allPapers.length });
  }

  // Update the editorial status of a submission, recording a timeline entry.
  if (req.method === "PATCH" || req.method === "PUT") {
    let body: { id?: unknown; status?: unknown; note?: unknown; authorVisible?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const id = typeof body.id === "number" ? body.id : parseInt(String(body.id), 10);
    if (!id || isNaN(id)) {
      return Response.json({ error: "A numeric paper id is required" }, { status: 400 });
    }

    const status = String(body.status ?? "");
    if (!isStatus(status)) {
      return Response.json(
        { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const note = typeof body.note === "string" ? body.note.trim() : "";
    const authorVisible = body.authorVisible === true || body.authorVisible === "true";

    const [updated] = await db
      .update(papers)
      .set({ status })
      .where(eq(papers.id, id))
      .returning({ id: papers.id, status: papers.status });

    if (!updated) {
      return Response.json({ error: "Paper not found" }, { status: 404 });
    }

    // Append the change to the author-facing timeline.
    await recordStatus(updated.id, status, note || null, authorVisible);

    return Response.json({ success: true, id: updated.id, status: updated.status });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/papers",
};
