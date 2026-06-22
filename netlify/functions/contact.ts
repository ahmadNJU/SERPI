import type { Config } from "@netlify/functions";
import { sendContactMessage } from "../lib/email.js";
import { clientIp, rateLimit } from "../lib/ratelimit.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!rateLimit(`contact:${clientIp(req)}`, 6, 60_000)) {
    return Response.json({ error: "Too many messages. Please wait a minute and try again." }, { status: 429 });
  }

  let body: { name?: unknown; email?: unknown; subject?: unknown; message?: unknown; website?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: real users never fill "website". Pretend success, send nothing.
  if (typeof body.website === "string" && body.website.trim()) {
    return Response.json({ success: true }, { status: 200 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || !email || !subject || !message) {
    return Response.json({ error: "Please complete all fields." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (name.length > 200 || subject.length > 300 || message.length > 5000) {
    return Response.json({ error: "One or more fields is too long." }, { status: 400 });
  }

  // Destination address is resolved server-side and never returned to the client.
  const sent = await sendContactMessage({ name, email, subject, message });
  if (!sent) {
    return Response.json(
      { error: "We could not send your message right now. Please try again later." },
      { status: 502 }
    );
  }

  return Response.json({ success: true });
};

export const config: Config = {
  path: "/api/contact",
};
