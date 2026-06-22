import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { papers } from "../../db/schema.js";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "Request must be multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Failed to parse form data" }, { status: 400 });
  }

  const title = (formData.get("title") as string | null)?.trim();
  const authors = (formData.get("authors") as string | null)?.trim();
  const abstract = (formData.get("abstract") as string | null)?.trim();
  const keywords = (formData.get("keywords") as string | null)?.trim() ?? "";
  const paperType = (formData.get("paper_type") as string | null)?.trim() ?? "article";
  const submitterName = (formData.get("submitter_name") as string | null)?.trim();
  const submitterEmail = (formData.get("submitter_email") as string | null)?.trim();
  const institution = (formData.get("institution") as string | null)?.trim() ?? "";
  const coverLetter = (formData.get("cover_letter") as string | null)?.trim() ?? "";
  const file = formData.get("manuscript") as File | null;

  if (!title || !authors || !abstract || !submitterName || !submitterEmail) {
    return Response.json({ error: "Missing required fields: title, authors, abstract, submitter_name, submitter_email" }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return Response.json({ error: "A manuscript file is required" }, { status: 400 });
  }

  const detectedType = ALLOWED_TYPES[file.type];
  if (!detectedType) {
    return Response.json({ error: "Only PDF or DOCX files are accepted" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File size must not exceed 25 MB" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(submitterEmail)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    const store = getStore({ name: "research-papers", consistency: "strong" });

    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `submissions/${timestamp}_${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    await store.set(fileKey, arrayBuffer);

    const [paper] = await db
      .insert(papers)
      .values({
        title,
        authors,
        abstract,
        keywords: keywords || null,
        paperType,
        submitterName,
        submitterEmail,
        institution: institution || null,
        coverLetter: coverLetter || null,
        fileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: detectedType,
        status: "submitted",
      })
      .returning();

    return Response.json(
      {
        success: true,
        message: "Manuscript submitted successfully",
        submissionId: paper.id,
        title: paper.title,
        submittedAt: paper.submittedAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Submission error:", err);
    return Response.json({ error: "Internal server error. Please try again later." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/submit-paper",
};
