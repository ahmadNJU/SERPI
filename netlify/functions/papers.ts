import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { papers } from "../../db/schema.js";

export default async (req: Request): Promise<Response> => {
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
        title: papers.title,
        authors: papers.authors,
        paperType: papers.paperType,
        submitterName: papers.submitterName,
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

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/papers",
};
