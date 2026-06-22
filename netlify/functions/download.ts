import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { papers } from "../../db/schema.js";
import { isEditorAuthorized, unauthorized } from "../lib/auth.js";

const MIME_BY_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

/**
 * Streams the stored manuscript file for a submission from Netlify Blobs.
 * Protected: requires a valid editorial bearer token.
 *
 *   GET /api/download?id=123   (Authorization: Bearer <EDITOR_TOKEN>)
 */
export default async (req: Request): Promise<Response> => {
  if (!isEditorAuthorized(req)) {
    return unauthorized();
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const id = parseInt(idParam ?? "", 10);
  if (!idParam || isNaN(id)) {
    return Response.json({ error: "A numeric id parameter is required" }, { status: 400 });
  }

  const [paper] = await db
    .select({
      fileKey: papers.fileKey,
      fileName: papers.fileName,
      fileType: papers.fileType,
    })
    .from(papers)
    .where(eq(papers.id, id));

  if (!paper) {
    return Response.json({ error: "Paper not found" }, { status: 404 });
  }

  const store = getStore({ name: "research-papers", consistency: "strong" });
  const blob = await store.get(paper.fileKey, { type: "arrayBuffer" });

  if (!blob) {
    return Response.json({ error: "Manuscript file not found in storage" }, { status: 404 });
  }

  const mime = MIME_BY_TYPE[paper.fileType] || "application/octet-stream";
  const safeName = (paper.fileName || `manuscript-${id}`).replace(/["\\\r\n]/g, "_");

  return new Response(blob, {
    status: 200,
    headers: {
      "content-type": mime,
      "content-disposition": `attachment; filename="${safeName}"`,
      "cache-control": "no-store",
    },
  });
};

export const config: Config = {
  path: "/api/download",
};
